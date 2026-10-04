import { api, mutate } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
let tab = "updates";
let feedMode = "foryou";
let profileId = null;
let storyTimer = null;
let activePost = null;
let createKind = "video";
let pending = [];
let mapCity = null;
let chatId = null;
let searchQ = "";
let carouselIndex = {};

const esc = (s = "") => s.replace(/[&<>]/g, c => ({ "&": "&", "<": "<", ">": ">" }[c]));
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);
const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };

function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1400);
}

function shell(inner) {
  const me = api.me();
  const notes = me ? api.db().notes.filter(n => n.user === me.id && !n.read).length : 0;
  app.innerHTML = `<div class="stage"><div class="phone">
    ${inner}
    <nav class="nav">
      <button data-tab="updates" class="${tab === "updates" ? "on" : ""}">⌂<span>Updates</span></button>
      <button data-tab="map" class="${tab === "map" ? "on" : ""}">⌖<span>Map</span></button>
      <button id="create-open"><span class="fab">+</span></button>
      <button data-tab="chat" class="${tab === "chat" ? "on" : ""}">✎<span>Chat</span></button>
      <button data-tab="settings" class="${tab === "settings" ? "on" : ""}">⚙<span>Settings</span></button>
    </nav>
    <div class="toast"></div>
    <div class="sheet" id="sheet"></div>
    <div class="storyview" id="storyview"></div>
  </div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; chatId = null; mapCity = null; profileId = null; render(); });
  $("#create-open").onclick = openCreate;
}

function render() {
  if (!api.me()) return auth();
  if (tab === "updates" && !profileId) return updates();
  if (tab === "updates" && profileId) return profile(profileId);
  if (tab === "map") return map();
  if (tab === "chat") return chatId ? thread(chatId) : chats();
  if (tab === "search") return search();
  if (tab === "notes") return notes();
  if (tab === "settings") return settings();
  updates();
}

function auth() {
  app.innerHTML = `<div class="stage"><div class="phone"><div class="auth">
    <div class="word" style="font-size:42px">Old Time</div>
    <p class="sub">Watch. Follow. Send. Find what’s nearby.</p>
    <input class="field" id="email" placeholder="Email" value="you@oldtime.app" />
    <input class="field" id="pass" type="password" placeholder="Password" value="oldtime" />
    <button class="btn" id="login">Log in</button>
    <button class="btn ghost" id="google">Continue with Google</button>
    <button class="btn ghost" id="apple">Continue with Apple</button>
    <button class="btn ghost" id="signup">Create account</button>
    <button class="btn ghost" id="forgot">Forgot password</button>
  </div></div></div>`;
  $("#login").onclick = () => { api.login($("#email").value.trim()); render(); };
  $("#google").onclick = $("#apple").onclick = () => { api.login("you@oldtime.app"); toast("Signed in"); render(); };
  $("#forgot").onclick = () => toast("Reset link sent");
  $("#signup").onclick = signup;
}
function signup() {
  app.innerHTML = `<div class="stage"><div class="phone"><div class="auth">
    <div class="word">Join Old Time</div>
    <input class="field" id="su-email" placeholder="Email" />
    <input class="field" id="su-user" placeholder="username" />
    <input class="field" id="su-name" placeholder="Display name" />
    <input class="field" id="su-bday" type="date" />
    <input class="field" id="su-bio" placeholder="Bio (optional)" />
    <button class="btn" id="go">Create account</button>
    <button class="btn ghost" id="back">Back</button>
    <p class="sub" id="err"></p>
  </div></div></div>`;
  $("#back").onclick = auth;
  $("#go").onclick = () => {
    try {
      api.signup({ email: $("#su-email").value, username: $("#su-user").value.toLowerCase(), name: $("#su-name").value, birthday: $("#su-bday").value, bio: $("#su-bio").value });
      render();
    } catch (e) { $("#err").textContent = e.message; }
  };
}

function updates() {
  const me = api.me();
  const stories = api.db().stories.filter(s => Date.now() - s.created < 864e5);
  const posts = api.ranked(feedMode);
  shell(`<section class="screen on">
    <div class="topbar">
      <div class="word">Old Time</div>
      <div class="pills"><button data-feed="foryou" class="${feedMode === "foryou" ? "on" : ""}">For You</button><button data-feed="following" class="${feedMode === "following" ? "on" : ""}">Following</button></div>
      <button class="icon" id="bell">◉${api.db().notes.some(n => n.user === me.id && !n.read) ? '<i class="badge"></i>' : ""}</button>
    </div>
    <div class="stories">${storyBubble(me, true)}${stories.map(s => storyBubble(api.user(s.author), false, s.id)).join("")}</div>
    <div class="feed" id="feed">${posts.map(postCard).join("") || `<div class="empty">Nothing here yet. Follow someone, or post.</div>`}</div>
  </section>`);
  $("#bell").onclick = () => { tab = "notes"; render(); };
  app.querySelectorAll("[data-feed]").forEach(b => b.onclick = () => { feedMode = b.dataset.feed; render(); });
  app.querySelectorAll("[data-story]").forEach(b => b.onclick = () => openStory(b.dataset.story));
  bindPosts();
  const vids = app.querySelectorAll("video");
  const io = new IntersectionObserver((ents) => ents.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) { v.play().catch(() => {}); markWatch(v.dataset.id, 0.7); }
    else v.pause();
  }), { threshold: 0.7 });
  vids.forEach(v => io.observe(v));
}
function storyBubble(user, mine, id) {
  if (!user) return "";
  return `<button class="story" data-story="${mine ? "me" : id}"><div class="ring ${mine ? "seen" : ""}"><img src="${user.avatar}" alt="" />${mine ? "" : ""}</div>${mine ? "Your story" : user.username}</button>`;
}
function postCard(p) {
  const u = api.user(p.author);
  const me = api.me();
  const liked = p.likes.includes(me.id);
  const saved = p.saves.includes(me.id);
  const following = me.following.includes(u.id) || u.id === me.id;
  if (p.kind === "video") {
    return `<article class="clip" data-id="${p.id}">
      <video src="${p.media[0]}" data-id="${p.id}" loop playsinline muted></video>
      <div class="shade"></div>
      ${rail(p, liked, saved)}
      <div class="meta">${head(u, following, p)}<div class="cap">${esc(p.caption)} <span class="tags">${(p.tags || []).map(t => "#" + t).join(" ")}</span></div><div class="sound">♫ ${esc(p.sound || "Original audio")}</div></div>
    </article>`;
  }
  if (p.kind === "text") {
    return `<article class="clip" data-id="${p.id}" style="background:${p.color}"><div class="textpost"><p>${esc(p.caption)}</p></div>${rail(p, liked, saved)}<div class="meta">${head(u, following, p)}</div></article>`;
  }
  const i = carouselIndex[p.id] || 0;
  const src = p.media[i] || p.media[0];
  return `<article class="clip" data-id="${p.id}">
    <img class="fullimg" src="${src}" alt="" data-dbl="${p.id}" />
    <div class="shade"></div>
    ${rail(p, liked, saved)}
    <div class="meta">${head(u, following, p)}<div class="cap">${esc(p.caption)} <span class="tags">${(p.tags || []).map(t => "#" + t).join(" ")}</span></div>
    ${p.media.length > 1 ? `<div class="dots">${p.media.map((_, n) => `<i class="${n === i ? "on" : ""}" data-dot="${p.id}:${n}"></i>`).join("")}</div>` : ""}</div>
  </article>`;
}
function head(u, following, p) {
  return `<div class="handle"><img src="${u.avatar}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /> <button data-profile="${u.id}">@${u.username}</button> ${u.verified ? '<span class="tick">✓</span>' : ""} ${following ? "" : `<button class="followchip" data-follow="${u.id}">Follow</button>`}<span class="sub" style="margin-left:auto">${p.location || ""}</span></div>`;
}
function rail(p, liked, saved) {
  return `<div class="rail">
    <button class="act ${liked ? "on" : ""}" data-like="${p.id}"><span class="bubble">♥</span>${fmt(p.likes.length)}</button>
    <button class="act" data-comment="${p.id}"><span class="bubble">💬</span>${fmt(p.comments.length)}</button>
    <button class="act" data-share="${p.id}"><span class="bubble">↗</span>Share</button>
    <button class="act ${saved ? "on" : ""}" data-save="${p.id}"><span class="bubble">🔖</span>${fmt(p.saves.length)}</button>
    <button data-sound="${p.id}" class="act"><span class="bubble">♫</span></button>
    <img class="avatar" src="${api.user(p.author).avatar}" data-profile="${p.author}" alt="" />
  </div>`;
}
function bindPosts() {
  app.querySelectorAll("[data-like]").forEach(b => b.onclick = () => like(b.dataset.like));
  app.querySelectorAll("[data-save]").forEach(b => b.onclick = () => save(b.dataset.save));
  app.querySelectorAll("[data-comment]").forEach(b => b.onclick = () => comments(b.dataset.comment));
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = () => share(b.dataset.share));
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = () => follow(b.dataset.follow));
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => { profileId = b.dataset.profile; tab = "updates"; render(); });
  app.querySelectorAll("[data-dot]").forEach(b => b.onclick = () => { const [id, n] = b.dataset.dot.split(":"); carouselIndex[id] = +n; render(); });
  app.querySelectorAll("[data-dbl]").forEach(img => {
    let last = 0;
    img.onclick = () => { const now = Date.now(); if (now - last < 280) like(img.dataset.dbl); last = now; };
  });
  app.querySelectorAll("[data-sound]").forEach(b => b.onclick = () => toast("Sound: " + (api.db().posts.find(p => p.id === b.dataset.sound).sound || "Original")));
  const searchBtn = document.createElement("button");
}
function like(id) {
  const me = api.me();
  mutate(db => {
    const p = db.posts.find(x => x.id === id);
    const i = p.likes.indexOf(me.id);
    if (i >= 0) p.likes.splice(i, 1); else { p.likes.push(me.id); (p.tags || []).forEach(t => db.interests[t] = (db.interests[t] || 0) + 1); db.notes.unshift({ id: "n" + Date.now(), user: p.author, kind: "like", actor: me.id, post: id, body: "liked your post", created: Date.now(), read: false }); }
  });
  render();
}
function save(id) {
  const me = api.me();
  mutate(db => {
    const p = db.posts.find(x => x.id === id);
    const i = p.saves.indexOf(me.id);
    if (i >= 0) p.saves.splice(i, 1); else p.saves.push(me.id);
  });
  toast("Saved"); render();
}
function follow(id) {
  const me = api.me();
  mutate(db => {
    const u = db.users.find(x => x.id === id);
    if (me.following.includes(id)) { me.following = me.following.filter(x => x !== id); u.followers = u.followers.filter(x => x !== me.id); }
    else { me.following.push(id); u.followers.push(me.id); db.notes.unshift({ id: "n" + Date.now(), user: id, kind: "follow", actor: me.id, body: "started following you", created: Date.now(), read: false }); }
  });
  render();
}
function share(id) {
  const link = location.href.split("#")[0] + "#p=" + id;
  navigator.clipboard?.writeText(link);
  mutate(db => { const p = db.posts.find(x => x.id === id); p.shares = (p.shares || 0) + 1; db.notes.unshift({ id: "n" + Date.now(), user: p.author, kind: "share", actor: api.me().id, post: id, body: "shared your post", created: Date.now(), read: false }); });
  toast("Link copied");
}
function markWatch(id, amount) { mutate(db => { const p = db.posts.find(x => x.id === id); if (p) p.watch = Math.min(1, (p.watch || 0) + amount * 0.05); }); }

function comments(id) {
  activePost = id;
  const p = api.db().posts.find(x => x.id === id);
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Comments</b><div id="clist" style="margin:10px 0"></div>
    <form id="cform" class="row"><input class="field" id="cbody" placeholder="Add a comment" /><button class="btn small" type="submit">Send</button></form></div>`;
  const draw = () => {
    $("#clist").innerHTML = p.comments.map(c => `<div style="margin:8px 0"><div class="row"><img src="${api.user(c.author).avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(c.author).username}</b> ${esc(c.body)}<div class="sub">${ago(c.created || Date.now())} · <button data-reply="${c.id}">Reply</button> · <button data-clike="${c.id}">♥ ${c.likes.length}</button> ${c.author === api.me().id || p.author === api.me().id ? `<button data-cdel="${c.id}">Delete</button>` : ""}</div></div></div>${(c.replies || []).map(r => `<div class="sub" style="margin-left:36px">@${api.user(r.author).username} ${esc(r.body)}</div>`).join("")}</div>`).join("") || `<div class="sub">No comments yet.</div>`;
    $("#clist").querySelectorAll("[data-reply]").forEach(b => b.onclick = () => { $("#cbody").value = "@" + api.user(p.comments.find(c => c.id === b.dataset.reply).author).username + " "; $("#cbody").dataset.reply = b.dataset.reply; });
    $("#clist").querySelectorAll("[data-clike]").forEach(b => b.onclick = () => { mutate(() => { const c = p.comments.find(x => x.id === b.dataset.clike); const i = c.likes.indexOf(api.me().id); if (i >= 0) c.likes.splice(i, 1); else c.likes.push(api.me().id); }); draw(); });
    $("#clist").querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => { mutate(() => { p.comments = p.comments.filter(c => c.id !== b.dataset.cdel); }); draw(); });
  };
  draw();
  $("#cform").onsubmit = (e) => {
    e.preventDefault();
    const body = $("#cbody").value.trim(); if (!body) return;
    mutate(db => {
      const post = db.posts.find(x => x.id === id);
      const parent = $("#cbody").dataset.reply;
      if (parent) { const c = post.comments.find(x => x.id === parent); c.replies = c.replies || []; c.replies.push({ id: "r" + Date.now(), author: api.me().id, body }); }
      else post.comments.push({ id: "c" + Date.now(), author: api.me().id, body, likes: [], replies: [], created: Date.now() });
      db.notes.unshift({ id: "n" + Date.now(), user: post.author, kind: "comment", actor: api.me().id, post: id, body: "commented: " + body.slice(0, 60), created: Date.now(), read: false });
    });
    $("#cbody").value = ""; draw();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function openStory(id) {
  const me = api.me();
  const list = id === "me" ? api.db().stories.filter(s => s.author === me.id) : api.db().stories.filter(s => s.id === id);
  if (!list.length) { openCreate(); createKind = "story"; return; }
  const s = list[0];
  const view = $("#storyview");
  view.classList.add("on");
  view.innerHTML = `<div class="progress"><b id="bar"></b></div><button id="sclose" style="position:absolute;top:22px;right:12px;color:#fff">✕</button>
    <div style="height:100%;background:${s.color || "#000"}">${s.media ? `<img src="${s.media}" style="width:100%;height:100%;object-fit:cover" />` : ""}<div style="position:absolute;left:16px;bottom:80px;font-size:28px;font-family:Fraunces,serif">${esc(s.text || "")}</div></div>`;
  $("#sclose").onclick = () => { view.classList.remove("on"); clearInterval(storyTimer); };
  let w = 0; const bar = $("#bar");
  storyTimer = setInterval(() => { w += 2; bar.style.width = w + "%"; if (w >= 100) { clearInterval(storyTimer); view.classList.remove("on"); } }, 80);
}

function openCreate() {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Create</b>
    <div class="seg" id="kinds"><button data-k="video">Video</button><button data-k="photo">Photo</button><button data-k="carousel">Carousel</button><button data-k="text">Text</button><button data-k="story">Story</button></div>
    <textarea class="field" id="cap" placeholder="Caption"></textarea>
    <input class="field" id="tags" placeholder="hashtags, separated by spaces" style="margin-top:8px" />
    <input class="field" id="loc" placeholder="Location" style="margin-top:8px" value="Miami" />
    <div class="row" style="margin:8px 0"><button class="btn ghost small" id="pick">Upload</button><input id="file" type="file" accept="image/*,video/*" multiple hidden /><span class="sub" id="picked">No file yet</span></div>
    <video id="prev" controls style="width:100%;max-height:180px;display:none;border-radius:12px"></video>
    <button class="btn" id="post" style="margin-top:10px">Post</button></div>`;
  const paint = () => sheet.querySelectorAll("#kinds button").forEach(b => b.classList.toggle("on", b.dataset.k === createKind));
  paint();
  sheet.querySelector("#kinds").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; createKind = b.dataset.k; paint(); };
  $("#pick").onclick = () => $("#file").click();
  $("#file").onchange = () => {
    pending = [...$("#file").files].map(f => ({ url: URL.createObjectURL(f), video: f.type.startsWith("video") }));
    $("#picked").textContent = pending.length + " file(s)";
    if (pending[0]?.video) { $("#prev").style.display = "block"; $("#prev").src = pending[0].url; }
  };
  $("#post").onclick = () => {
    const caption = $("#cap").value.trim();
    if (!caption && createKind !== "story") return toast("Add a caption");
    if ((createKind === "video" || createKind === "photo" || createKind === "carousel") && !pending.length) return toast("Add media");
    mutate(db => {
      const item = { id: "p" + Date.now(), author: api.me().id, kind: createKind === "story" ? "photo" : createKind, caption, tags: $("#tags").value.split(/[#\s]+/).filter(Boolean), media: pending.map(p => p.url), sound: "Original audio", location: $("#loc").value, likes: [], comments: [], saves: [], created: Date.now(), views: 0 };
      if (createKind === "story") db.stories.unshift({ id: "s" + Date.now(), author: api.me().id, kind: pending[0]?.video ? "video" : "text", media: pending[0]?.url || "", text: caption, created: Date.now(), color: "#1b140c" });
      else db.posts.unshift(item);
    });
    pending = []; sheet.classList.remove("on"); toast("Posted"); tab = "updates"; render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function profile(id) {
  const u = api.user(id);
  const me = api.me();
  const posts = api.db().posts.filter(p => p.author === u.id && p.kind !== "text");
  const videos = posts.filter(p => p.kind === "video");
  const saved = api.db().posts.filter(p => p.saves.includes(u.id));
  const mine = u.id === me.id;
  const mode = profile.mode || "posts";
  const grid = (mode === "videos" ? videos : mode === "saved" && mine ? saved : posts);
  shell(`<section class="screen on"><div class="scroll page">
    <button class="sub" id="back">← Updates</button>
    <div class="row" style="margin:12px 0">
      <img src="${u.avatar}" style="width:78px;height:78px;border-radius:50%;object-fit:cover" />
      <div><b>${esc(u.name)}</b> ${u.verified ? '<span class="tick">✓</span>' : ""}<div class="sub">@${u.username}</div><div class="sub">${esc(u.bio)}</div></div>
    </div>
    <div class="row" style="gap:16px;margin-bottom:10px"><div><b>${fmt(u.followers.length)}</b><div class="sub">Followers</div></div><div><b>${fmt(u.following.length)}</b><div class="sub">Following</div></div><div><b>${fmt(api.db().posts.filter(p => p.author === u.id).reduce((n, p) => n + p.likes.length, 0))}</b><div class="sub">Likes</div></div></div>
    ${mine ? "" : `<div class="row"><button class="btn small" id="pfollow">${me.following.includes(u.id) ? "Following" : "Follow"}</button><button class="btn ghost small" id="pmsg">Message</button><button class="btn ghost small" id="prep">Report</button>${u.private ? "" : ""}</div>`}
    <div class="seg"><button data-m="posts" class="${mode === "posts" ? "on" : ""}">Posts</button><button data-m="videos" class="${mode === "videos" ? "on" : ""}">Videos</button>${mine ? `<button data-m="saved" class="${mode === "saved" ? "on" : ""}">Saved</button>` : ""}</div>
    <div class="grid3">${grid.map(p => `<button class="cell" data-open="${p.id}">${p.media?.[0] ? (p.kind === "video" ? `<video src="${p.media[0]}" muted></video>` : `<img src="${p.media[0]}" />`) : `<div class="textpost"><p>${esc(p.caption.slice(0, 40))}</p></div>`}</button>`).join("") || `<div class="empty">No posts yet.</div>`}</div>
  </div></section>`);
  $("#back").onclick = () => { profileId = null; render(); };
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { profile.mode = b.dataset.m; render(); });
  $("#pfollow") && ($("#pfollow").onclick = () => follow(u.id));
  $("#pmsg") && ($("#pmsg").onclick = () => { tab = "chat"; chatId = ensureConvo(u.id); render(); });
  $("#prep") && ($("#prep").onclick = () => { mutate(db => db.reports.push({ id: "r" + Date.now(), by: me.id, target: u.id, reason: "profile" })); toast("Reported"); });
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { tab = "updates"; profileId = null; feedMode = "foryou"; render(); });
}
function ensureConvo(uid) {
  const me = api.me();
  let c = api.db().convos.find(x => x.members.length === 2 && x.members.includes(me.id) && x.members.includes(uid));
  if (!c) { c = { id: "cv" + Date.now(), members: [me.id, uid], messages: [] }; mutate(db => db.convos.unshift(c)); }
  return c.id;
}

function chats() {
  const me = api.me();
  shell(`<section class="screen on"><div class="scroll page"><div class="h1">Chat</div>
    ${api.db().convos.filter(c => c.members.includes(me.id)).map(c => {
      const others = c.members.filter(id => id !== me.id).map(api.user);
      const last = c.messages[c.messages.length - 1];
      return `<button class="listbtn" data-cv="${c.id}"><img src="${others[0].avatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover" /><div><b>${c.title || others.map(o => o.name).join(", ")}</b><div class="sub">${last ? esc(last.body) : "Say something"}</div></div></button>`;
    }).join("")}
    <button class="btn" id="newchat" style="margin-top:12px">New chat</button>
  </div></section>`);
  app.querySelectorAll("[data-cv]").forEach(b => b.onclick = () => { chatId = b.dataset.cv; render(); });
  $("#newchat").onclick = () => {
    const name = prompt("Username to message");
    const u = api.user(name);
    if (!u) return toast("No user");
    chatId = ensureConvo(u.id); render();
  };
}
function thread(id) {
  const c = api.db().convos.find(x => x.id === id);
  const me = api.me();
  shell(`<section class="screen on"><div class="topbar"><button id="back">←</button><b>${c.title || c.members.filter(i => i !== me.id).map(i => api.user(i).name).join(", ")}</b><span></span></div>
    <div class="scroll" id="msgs" style="padding:12px">${c.messages.map(m => `<div class="bubble-msg ${m.author === me.id ? "mine" : "theirs"}">${esc(m.body)}<div class="sub">${m.read ? "Read" : "Sent"} · <button data-del="${m.id}">Delete</button></div></div>`).join("")}<div class="sub" id="typing"></div></div>
    <form id="send" class="row" style="padding:8px 12px 86px"><input class="field" id="msg" placeholder="Message" /><button class="btn small">Send</button></form>
  </section>`);
  $("#back").onclick = () => { chatId = null; render(); };
  $("#msgs").scrollTop = 9999;
  $("#send").onsubmit = (e) => {
    e.preventDefault();
    const body = $("#msg").value.trim(); if (!body) return;
    mutate(db => db.convos.find(x => x.id === id).messages.push({ id: "m" + Date.now(), author: me.id, body, created: Date.now(), read: false }));
    render();
    setTimeout(() => { const t = $("#typing"); if (t) t.textContent = "typing…"; }, 200);
  };
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { mutate(db => { const cv = db.convos.find(x => x.id === id); cv.messages = cv.messages.filter(m => m.id !== b.dataset.del || m.author !== me.id); }); render(); });
}

function map() {
  const cities = [
    { name: "Miami", x: "62%", y: "68%" },
    { name: "New York", x: "74%", y: "32%" },
    { name: "Chicago", x: "52%", y: "38%" },
    { name: "Los Angeles", x: "18%", y: "48%" }
  ];
  if (mapCity) {
    const posts = api.posts().filter(p => p.location === mapCity);
    shell(`<section class="screen on"><div class="scroll page"><button id="back" class="sub">← Map</button><div class="h1">${mapCity}</div><p class="sub">Public posts from this area</p>
      ${posts.map(p => `<button class="listbtn" data-open="${p.id}"><img src="${p.media[0] || api.user(p.author).avatar}" style="width:54px;height:54px;object-fit:cover;border-radius:10px" /><div><b>@${api.user(p.author).username}</b><div class="sub">${esc(p.caption)}</div></div></button>`).join("") || `<div class="empty">No public posts here yet.</div>`}
    </div></section>`);
    $("#back").onclick = () => { mapCity = null; render(); };
    return;
  }
  shell(`<section class="screen on"><div class="topbar"><div class="word">Map</div><span class="sub">Nearby</span></div>
    <div class="mapwrap">${cities.map(c => `<button class="pin" style="left:${c.x};top:${c.y}" data-city="${c.name}"><i>${c.name}</i></button>`).join("")}</div>
  </section>`);
  app.querySelectorAll("[data-city]").forEach(b => b.onclick = () => { mapCity = b.dataset.city; render(); });
}

function search() {
  const q = searchQ.toLowerCase();
  const users = api.db().users.filter(u => !q || u.username.includes(q) || u.name.toLowerCase().includes(q));
  const posts = api.posts().filter(p => !q || p.caption.toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)) || (p.location || "").toLowerCase().includes(q));
  shell(`<section class="screen on"><div class="scroll page"><div class="h1">Search</div>
    <input class="search" id="q" placeholder="People, posts, tags, places" value="${esc(searchQ)}" />
    <div class="sub">Suggested</div>
    ${users.slice(0, 6).map(u => `<button class="listbtn" data-profile="${u.id}"><img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" /><div><b>@${u.username}</b><div class="sub">${esc(u.bio)}</div></div></button>`).join("")}
    <div class="grid3" style="margin-top:10px">${posts.slice(0, 9).map(p => `<div class="cell">${p.media[0] ? `<img src="${p.media[0]}" />` : ""}</div>`).join("")}</div>
  </div></section>`);
  $("#q").oninput = (e) => { searchQ = e.target.value; render(); };
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => { profileId = b.dataset.profile; tab = "updates"; render(); });
}

function notes() {
  const me = api.me();
  mutate(db => db.notes.forEach(n => { if (n.user === me.id) n.read = true; }));
  shell(`<section class="screen on"><div class="scroll page"><button id="back" class="sub">← Updates</button><div class="h1">Notifications</div>
    ${api.db().notes.filter(n => n.user === me.id).map(n => `<div class="listbtn"><img src="${api.user(n.actor)?.avatar || ""}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(n.actor)?.username}</b> ${esc(n.body)}<div class="sub">${ago(n.created)}</div></div></div>`).join("") || `<div class="empty">You’re caught up.</div>`}
  </div></section>`);
  $("#back").onclick = () => { tab = "updates"; render(); };
}

function settings() {
  const me = api.me();
  shell(`<section class="screen on"><div class="scroll page"><div class="h1">Settings</div>
    <button class="listbtn" id="edit">Account · Edit profile</button>
    <button class="listbtn" id="priv">Privacy · ${me.private ? "Private" : "Public"}</button>
    <button class="listbtn" id="blocked">Blocked users</button>
    <button class="listbtn" id="notifs">Notifications</button>
    <button class="listbtn" id="sec">Security</button>
    <button class="listbtn" id="help">Help</button>
    <button class="listbtn" id="about">About Old Time</button>
    <button class="listbtn" id="searchtab">Search</button>
    <button class="btn ghost" id="out" style="margin-top:16px">Log out</button>
  </div></section>`);
  $("#out").onclick = () => { api.logout(); render(); };
  $("#searchtab").onclick = () => { tab = "search"; render(); };
  $("#priv").onclick = () => { mutate(db => { api.me().private = !api.me().private; }); toast(api.me().private ? "Private" : "Public"); render(); };
  $("#edit").onclick = () => { const bio = prompt("Bio", me.bio); const name = prompt("Name", me.name); if (bio != null) mutate(() => { me.bio = bio; me.name = name || me.name; }); render(); };
  $("#blocked").onclick = () => toast(api.db().blocks.filter(b => b.by === me.id).map(b => b.who).join(", ") || "None blocked");
  $("#notifs").onclick = () => toast("Likes, comments, follows: on");
  $("#sec").onclick = () => toast("Password last changed today");
  $("#help").onclick = () => toast("help@oldtime.app");
  $("#about").onclick = () => toast("Old Time · watch, follow, find nearby");
}

render();
