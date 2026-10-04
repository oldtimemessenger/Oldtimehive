import { api, mutate, fileToData } from "./store.js";
import { ensureConvo as makeConvo, openChatList, openThread } from "./chat.js";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
let tab = "updates";
let feedMode = "foryou";
let profileId = null;
let profileMode = "posts";
let storyTimer = null;
let createKind = "video";
let pending = [];
let mapCity = null;
let chatId = null;
let searchQ = "";
let carouselIndex = {};
let muted = true;
let viewer = null;

const esc = (s = "") => String(s).replace(/[&<>]/g, c => ({ "&": "&", "<": "<", ">": ">" }[c]));
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n || 0);
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };

function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1600);
}
function shell(inner, mode) {
  const light = mode === "light";
  app.innerHTML = `<div class="stage"><div class="phone ${light ? "light" : ""}">
    ${inner}
    <nav class="nav ${light ? "lightnav" : ""}">
      <button data-tab="updates">${light ? "☺" : "▶"}<span>${light ? "People" : "Updates"}</span></button>
      <button data-tab="map">${light ? "☎" : "⌖"}<span>${light ? "Calls" : "Map"}</span></button>
      <button id="create-open"><span class="fab">${light ? "+" : "♪"}</span></button>
      <button data-tab="chat">✎<span>Chat</span></button>
      <button data-tab="settings"><span class="orb"></span><span>${light ? "Settings" : "You"}</span></button>
    </nav>
    <div class="toast"></div>
    <div class="sheet" id="sheet"></div>
    <div class="storyview" id="storyview"></div>
  </div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    if (tab === "settings" && !light) { profileId = api.me().id; tab = "updates"; profileMode = "posts"; }
    else { chatId = null; mapCity = null; profileId = null; viewer = null; }
    render();
  });
  $("#create-open").onclick = () => openCreate();
}
function render() {
  if (!api.me()) return auth();
  if (viewer) return postViewer(viewer);
  if (tab === "updates" && profileId) return profile(profileId);
  if (tab === "updates") return updates();
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
    <input class="field" id="email" placeholder="Email or username" value="you@oldtime.app" />
    <input class="field" id="pass" type="password" placeholder="Password" value="oldtime" />
    <p class="sub" id="err"></p>
    <button class="btn" id="login">Log in</button>
    <button class="btn ghost" id="google">Continue with Google</button>
    <button class="btn ghost" id="apple">Continue with Apple</button>
    <button class="btn ghost" id="signup">Create account</button>
    <button class="btn ghost" id="forgot">Forgot password</button>
  </div></div></div>`;
  $("#login").onclick = () => {
    try { api.login($("#email").value.trim(), $("#pass").value); render(); }
    catch (e) { $("#err").textContent = e.message; }
  };
  $("#google").onclick = () => { api.oauth("google"); render(); };
  $("#apple").onclick = () => { api.oauth("apple"); render(); };
  $("#forgot").onclick = forgot;
  $("#signup").onclick = signup;
}
function signup() {
  app.innerHTML = `<div class="stage"><div class="phone"><div class="auth">
    <div class="word">Join Old Time</div>
    <input class="field" id="su-email" placeholder="Email" />
    <input class="field" id="su-user" placeholder="username" />
    <input class="field" id="su-name" placeholder="Display name" />
    <input class="field" id="su-pass" type="password" placeholder="Password" />
    <input class="field" id="su-bday" type="date" />
    <input class="field" id="su-bio" placeholder="Bio (optional)" />
    <button class="btn" id="go">Create account</button>
    <button class="btn ghost" id="back">Back</button>
    <p class="sub" id="err"></p>
  </div></div></div>`;
  $("#back").onclick = auth;
  $("#go").onclick = () => {
    try {
      api.signup({ email: $("#su-email").value.trim(), username: $("#su-user").value.trim(), name: $("#su-name").value.trim(), password: $("#su-pass").value, birthday: $("#su-bday").value, bio: $("#su-bio").value.trim() });
      render();
    } catch (e) { $("#err").textContent = e.message; }
  };
}
function forgot() {
  app.innerHTML = `<div class="stage"><div class="phone"><div class="auth">
    <div class="word">Reset password</div>
    <input class="field" id="em" placeholder="Email" />
    <input class="field" id="np" type="password" placeholder="New password" />
    <button class="btn" id="go">Update password</button>
    <button class="btn ghost" id="back">Back</button>
    <p class="sub" id="err"></p>
  </div></div></div>`;
  $("#back").onclick = auth;
  $("#go").onclick = () => {
    const u = api.db().users.find(x => x.email === $("#em").value.trim());
    if (!u) return $("#err").textContent = "No account for that email";
    if ($("#np").value.length < 6) return $("#err").textContent = "Password needs 6+ characters";
    mutate(db => { db.users.find(x => x.id === u.id).password = $("#np").value; db.resets.push({ email: u.email, at: Date.now() }); });
    auth();
  };
}

function updates() {
  const me = api.me();
  const stories = api.db().stories.filter(s => Date.now() - s.created < 864e5 && api.canSee(s.author));
  const byAuthor = new Map();
  stories.forEach(s => { if (!byAuthor.has(s.author)) byAuthor.set(s.author, s); });
  const posts = api.ranked(feedMode);
  const unread = api.db().notes.filter(n => n.user === me.id && !n.read).length;
  shell(`<section class="screen on">
    <div class="feed" id="feed">${posts.map(postCard).join("") || `<div class="empty">Nothing in this feed yet.</div>`}</div>
    <button class="hooktop" id="hook">+ Create</button>
    <div class="topbar" style="position:absolute;left:0;right:90px;background:transparent">
      <div class="pills"><button data-feed="foryou" class="${feedMode === "foryou" ? "on" : ""}">For You</button><button data-feed="following" class="${feedMode === "following" ? "on" : ""}">Following</button></div>
      <button class="icon" id="bell">◉${unread ? '<i class="badge"></i>' : ""}</button>
    </div>
  </section>`);
  $("#bell").onclick = () => { tab = "notes"; render(); };
  $("#hook").onclick = () => { createKind = "video"; openCreate(); };
  app.querySelectorAll("[data-feed]").forEach(b => b.onclick = () => { feedMode = b.dataset.feed; render(); });
  bindPosts();
  const vids = [...app.querySelectorAll("video")];
  const io = new IntersectionObserver((ents) => ents.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) { v.muted = muted; v.play().catch(() => {}); watch(v.dataset.id); }
    else v.pause();
  }), { threshold: 0.65 });
  vids.forEach(v => io.observe(v));
}
function postCard(p) {
  const u = api.user(p.author);
  const me = api.me();
  const liked = p.likes.includes(me.id);
  const saved = p.saves.includes(me.id);
  const following = me.following.includes(u.id) || u.id === me.id;
  const media = p.kind === "video"
    ? `<video src="${p.media[0]}" data-id="${p.id}" loop playsinline ${muted ? "muted" : ""}></video>`
    : p.kind === "text"
      ? `<div class="textpost" style="height:100%;background:${p.color}"><p>${esc(p.caption)}</p></div>`
      : `<img class="fullimg" src="${p.media[carouselIndex[p.id] || 0]}" alt="" data-dbl="${p.id}" />`;
  return `<article class="clip" data-id="${p.id}">${media}<div class="shade"></div>
    <div class="rail">
      <button class="act ${liked ? "on" : ""}" data-like="${p.id}"><span class="bubble">♡</span>${fmt(p.likes.length)}</button>
      <button class="act" data-comment="${p.id}"><span class="bubble">💬</span>${fmt(p.comments.length)}</button>
      <button class="act" data-share="${p.id}"><span class="bubble">↗</span></button>
    </div>
    <div class="meta" style="bottom:158px">
      <div class="handle"><span class="orb"></span> <button data-profile="${u.id}">${esc(u.name)}</button> ${following ? "" : `<button class="followpill" data-follow="${u.id}">Follow</button>`}</div>
      <div class="cap">${esc(p.caption)}</div>
    </div>
    <div class="soundbar">
      <img src="${u.avatar}" alt="" />
      <div><b>${esc(p.sound || "Original audio")}</b><div class="sub">▶ ${fmt(p.views || 0)}</div></div>
      <button class="remix" data-save="${p.id}">＋</button>
      <button class="remix" data-share="${p.id}">Share</button>
    </div>
  </article>`;
}
function head(u, following, p) {
  return `<div class="handle"><img src="${u.avatar}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /> <button data-profile="${u.id}">@${u.username}</button> ${u.verified ? '<span class="tick">✓</span>' : ""} ${following ? "" : `<button class="followchip" data-follow="${u.id}">Follow</button>`}</div>`;
}
function rail(p, liked, saved) {
  return `<div class="rail">
    <button class="act ${liked ? "on" : ""}" data-like="${p.id}"><span class="bubble">♥</span>${fmt(p.likes.length)}</button>
    <button class="act" data-comment="${p.id}"><span class="bubble">💬</span>${fmt(p.comments.length)}</button>
    <button class="act" data-share="${p.id}"><span class="bubble">↗</span>${fmt(p.shares || 0)}</button>
    <button class="act ${saved ? "on" : ""}" data-save="${p.id}"><span class="bubble">🔖</span>${fmt(p.saves.length)}</button>
    <button class="act" data-mute="${p.id}"><span class="bubble">${muted ? "🔇" : "🔊"}</span></button>
    <img class="avatar" src="${api.user(p.author).avatar}" data-profile="${p.author}" alt="" />
  </div>`;
}
function bindPosts() {
  app.querySelectorAll("[data-like]").forEach(b => b.onclick = (e) => { e.stopPropagation(); like(b.dataset.like); });
  app.querySelectorAll("[data-save]").forEach(b => b.onclick = (e) => { e.stopPropagation(); save(b.dataset.save); });
  app.querySelectorAll("[data-comment]").forEach(b => b.onclick = (e) => { e.stopPropagation(); comments(b.dataset.comment); });
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = (e) => { e.stopPropagation(); share(b.dataset.share); });
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = (e) => { e.stopPropagation(); follow(b.dataset.follow); });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = (e) => { e.stopPropagation(); profileId = b.dataset.profile; profileMode = "posts"; tab = "updates"; render(); });
  app.querySelectorAll("[data-dot]").forEach(b => b.onclick = (e) => { e.stopPropagation(); const [id, n] = b.dataset.dot.split(":"); carouselIndex[id] = +n; render(); });
  app.querySelectorAll("[data-mute]").forEach(b => b.onclick = (e) => { e.stopPropagation(); muted = !muted; render(); });
  app.querySelectorAll("[data-dbl]").forEach(el => {
    let last = 0;
    el.onclick = () => { const now = Date.now(); if (now - last < 280) like(el.dataset.dbl); last = now; };
  });
  app.querySelectorAll(".clip video").forEach(v => v.onclick = () => { if (v.paused) v.play(); else v.pause(); });
}
function like(id) {
  const me = api.me();
  mutate(db => {
    const p = db.posts.find(x => x.id === id);
    const i = p.likes.indexOf(me.id);
    if (i >= 0) p.likes.splice(i, 1);
    else { p.likes.push(me.id); (p.tags || []).forEach(t => db.interests[t] = (db.interests[t] || 0) + 1); if (p.author !== me.id) db.notes.unshift({ id: "n" + Date.now(), user: p.author, kind: "like", actor: me.id, post: id, body: "liked your post", created: Date.now(), read: false }); }
  });
  render();
}
function save(id) {
  const me = api.me();
  mutate(db => { const p = db.posts.find(x => x.id === id); const i = p.saves.indexOf(me.id); if (i >= 0) p.saves.splice(i, 1); else p.saves.push(me.id); });
  render();
}
function follow(id) {
  const me = api.me();
  const u = api.user(id);
  mutate(db => {
    const meU = db.users.find(x => x.id === me.id);
    const them = db.users.find(x => x.id === id);
    if (meU.following.includes(id)) {
      meU.following = meU.following.filter(x => x !== id);
      them.followers = them.followers.filter(x => x !== me.id);
      db.requests = db.requests.filter(r => !(r.from === me.id && r.to === id));
    } else if (them.private) {
      if (!db.requests.some(r => r.from === me.id && r.to === id)) db.requests.push({ from: me.id, to: id, at: Date.now() });
    } else {
      meU.following.push(id); them.followers.push(me.id);
      db.notes.unshift({ id: "n" + Date.now(), user: id, kind: "follow", actor: me.id, body: "started following you", created: Date.now(), read: false });
    }
  });
  toast(u.private && !api.me().following.includes(id) ? "Requested" : "Updated");
  render();
}
function share(id) {
  const link = "https://oldtime.app/p/" + id;
  navigator.clipboard?.writeText(link);
  mutate(db => { const p = db.posts.find(x => x.id === id); p.shares = (p.shares || 0) + 1; if (p.author !== api.me().id) db.notes.unshift({ id: "n" + Date.now(), user: p.author, kind: "share", actor: api.me().id, post: id, body: "shared your post", created: Date.now(), read: false }); });
  toast("Link copied");
  render();
}
function watch(id) { mutate(db => { const p = db.posts.find(x => x.id === id); if (p) { p.watch = Math.min(1, (p.watch || 0) + 0.08); p.views = (p.views || 0) + 1; } }); }

function comments(id) {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  const draw = () => {
    const p = api.db().posts.find(x => x.id === id);
    sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Comments</b><div id="clist" style="margin:10px 0;max-height:46vh;overflow:auto"></div>
      <form id="cform" class="row"><input class="field" id="cbody" placeholder="Add a comment" /><button class="btn small" type="submit">Send</button></form></div>`;
    $("#clist").innerHTML = p.comments.map(c => `<div style="margin:10px 0"><div class="row" style="align-items:flex-start"><img src="${api.user(c.author).avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(c.author).username}</b> ${esc(c.body)}<div class="sub">${ago(c.created)} · <button data-reply="${c.id}">Reply</button> · <button data-clike="${c.id}">♥ ${c.likes.length}</button> ${c.author === api.me().id || p.author === api.me().id ? `<button data-cdel="${c.id}">Delete</button>` : ""}</div>${(c.replies || []).map(r => `<div class="sub" style="margin-top:4px">@${api.user(r.author).username} ${esc(r.body)} ${r.author === api.me().id ? `<button data-rdel="${c.id}:${r.id}">Delete</button>` : ""}</div>`).join("")}</div></div></div>`).join("") || `<div class="sub">No comments yet.</div>`;
    $("#clist").querySelectorAll("[data-reply]").forEach(b => b.onclick = () => { $("#cbody").value = "@" + api.user(p.comments.find(c => c.id === b.dataset.reply).author).username + " "; $("#cbody").dataset.reply = b.dataset.reply; $("#cbody").focus(); });
    $("#clist").querySelectorAll("[data-clike]").forEach(b => b.onclick = () => { mutate(db => { const c = db.posts.find(x => x.id === id).comments.find(x => x.id === b.dataset.clike); const i = c.likes.indexOf(api.me().id); if (i >= 0) c.likes.splice(i, 1); else c.likes.push(api.me().id); }); draw(); });
    $("#clist").querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => { mutate(db => { const post = db.posts.find(x => x.id === id); post.comments = post.comments.filter(c => c.id !== b.dataset.cdel); }); draw(); });
    $("#clist").querySelectorAll("[data-rdel]").forEach(b => b.onclick = () => { const [cid, rid] = b.dataset.rdel.split(":"); mutate(db => { const c = db.posts.find(x => x.id === id).comments.find(x => x.id === cid); c.replies = c.replies.filter(r => r.id !== rid); }); draw(); });
    $("#cform").onsubmit = (e) => {
      e.preventDefault();
      const body = $("#cbody").value.trim(); if (!body) return;
      const parent = $("#cbody").dataset.reply;
      mutate(db => {
        const post = db.posts.find(x => x.id === id);
        if (parent) { const c = post.comments.find(x => x.id === parent); c.replies = c.replies || []; c.replies.push({ id: "r" + Date.now(), author: api.me().id, body, created: Date.now() }); }
        else post.comments.push({ id: "c" + Date.now(), author: api.me().id, body, likes: [], replies: [], created: Date.now() });
        if (post.author !== api.me().id) db.notes.unshift({ id: "n" + Date.now(), user: post.author, kind: parent ? "reply" : "comment", actor: api.me().id, post: id, body: (parent ? "replied: " : "commented: ") + body.slice(0, 80), created: Date.now(), read: false });
      });
      draw();
    };
    sheet.onclick = (e) => { if (e.target === sheet) { sheet.classList.remove("on"); render(); } };
  };
  draw();
}

function openStory(authorId) {
  const list = api.db().stories.filter(s => s.author === authorId && Date.now() - s.created < 864e5);
  if (!list.length) { createKind = "story"; openCreate(); return; }
  let i = 0;
  const view = $("#storyview");
  view.classList.add("on");
  const show = () => {
    const s = list[i]; if (!s) { view.classList.remove("on"); return; }
    view.innerHTML = `<div class="progress"><b id="bar"></b></div>
      <div class="row" style="position:absolute;top:24px;left:12px;right:48px;z-index:2"><img src="${api.user(s.author).avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><b>@${api.user(s.author).username}</b></div>
      <button id="sclose" style="position:absolute;top:22px;right:12px;z-index:2">✕</button>
      <div style="height:100%;background:${s.color || "#000"}">${s.media ? (String(s.media).startsWith("data:video") || s.kind === "video" ? `<video src="${s.media}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${s.media}" style="width:100%;height:100%;object-fit:cover" />`) : ""}<div style="position:absolute;left:16px;bottom:90px;font-size:28px;font-family:Fraunces,serif">${esc(s.text || "")}</div></div>`;
    $("#sclose").onclick = () => { view.classList.remove("on"); clearInterval(storyTimer); };
    let w = 0; clearInterval(storyTimer);
    storyTimer = setInterval(() => { w += 2; const bar = $("#bar"); if (bar) bar.style.width = w + "%"; if (w >= 100) { i++; show(); } }, 90);
  };
  show();
}

function openCreate() {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel" style="max-height:94%"><div class="grab"></div><b>Create</b>
    <div class="seg" id="kinds">
      <button data-k="video">Video</button><button data-k="photo">Photo</button><button data-k="carousel">Carousel</button><button data-k="text">Text</button><button data-k="story">Story</button>
    </div>
    <textarea class="field" id="cap" placeholder="Caption, with #tags or @names"></textarea>
    <input class="field" id="loc" placeholder="Location" style="margin-top:8px" value="${api.me().city || "Miami"}" />
    <select class="field" id="vis" style="margin-top:8px"><option value="public">Public</option><option value="followers">Followers</option></select>
    <div class="row" style="margin:8px 0;flex-wrap:wrap"><button class="btn ghost small" id="pick">Upload</button><button class="btn ghost small" id="rec">Record</button><input id="file" type="file" accept="image/*,video/*" multiple hidden /><input id="cam" type="file" accept="video/*,image/*" capture="environment" hidden /><span class="sub" id="picked">No file yet</span></div>
    <video id="prev" controls style="width:100%;max-height:160px;display:none;border-radius:12px"></video>
    <img id="pimg" style="width:100%;max-height:160px;object-fit:cover;display:none;border-radius:12px" />
    <label class="sub">Trim end (seconds, optional) <input class="field" id="trim" type="number" min="1" placeholder="full" /></label>
    <button class="btn" id="post" style="margin-top:10px">Post</button></div>`;
  const paint = () => sheet.querySelectorAll("#kinds button").forEach(b => b.classList.toggle("on", b.dataset.k === createKind));
  paint();
  sheet.querySelector("#kinds").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; createKind = b.dataset.k; paint(); };
  $("#pick").onclick = () => $("#file").click();
  $("#rec").onclick = () => $("#cam").click();
  const take = async (files) => {
    pending = [];
    for (const f of files) pending.push(await fileToData(f));
    $("#picked").textContent = pending.length + " ready";
    if (pending[0]?.video) { $("#prev").style.display = "block"; $("#prev").src = pending[0].url; $("#pimg").style.display = "none"; }
    else if (pending[0]) { $("#pimg").style.display = "block"; $("#pimg").src = pending[0].url; $("#prev").style.display = "none"; }
  };
  $("#file").onchange = () => take([...$("#file").files]);
  $("#cam").onchange = () => take([...$("#cam").files]);
  $("#post").onclick = async () => {
    const caption = $("#cap").value.trim();
    const tags = [...caption.matchAll(/#([a-z0-9_]+)/gi)].map(m => m[1].toLowerCase());
    if (!caption && createKind !== "photo" && createKind !== "video") return toast("Add a caption");
    if (["video", "photo", "carousel"].includes(createKind) && !pending.length) return toast("Add a photo or video");
    const trim = Number($("#trim").value) || 0;
    mutate(db => {
      if (createKind === "story") db.stories.unshift({ id: "s" + Date.now(), author: api.me().id, kind: pending[0]?.video ? "video" : (pending[0] ? "photo" : "text"), media: pending[0]?.url || "", text: caption, created: Date.now(), color: "#1b140c" });
      else db.posts.unshift({ id: "p" + Date.now(), author: api.me().id, kind: createKind, caption: caption || " ", tags, media: pending.map(p => p.url), sound: "Original audio", location: $("#loc").value || api.me().city, visibility: $("#vis").value, trim, likes: [], comments: [], saves: [], created: Date.now(), views: 0, shares: 0, color: "linear-gradient(160deg,#1b140c,#3a2a18)" });
    });
    pending = []; sheet.classList.remove("on"); toast("Posted"); tab = "updates"; profileId = null; render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function profile(id) {
  const u = api.user(id);
  const me = api.me();
  if (!u) { profileId = null; return updates(); }
  const locked = u.private && u.id !== me.id && !u.followers.includes(me.id);
  const posts = api.db().posts.filter(p => p.author === u.id);
  const videos = posts.filter(p => p.kind === "video");
  const saved = api.db().posts.filter(p => p.saves.includes(u.id));
  const mine = u.id === me.id;
  const grid = locked ? [] : (profileMode === "videos" ? videos : profileMode === "saved" && mine ? saved : posts);
  const requested = api.db().requests.some(r => r.from === me.id && r.to === u.id);
  shell(`<section class="screen on"><div class="scroll page" style="padding-top:18px">
    <div class="row" style="justify-content:space-between"><button id="back">←</button><button id="sharep">↗</button></div>
    <img class="hero-circle" src="${(posts.find(p => p.media?.[0]) || {}).media?.[0] || u.avatar}" alt="" />
    <div class="row" style="align-items:flex-end;margin-top:-28px">
      <img src="${u.avatar}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #111" />
      <div><b style="font-size:28px">${esc(u.name)}</b><div class="sub">@${u.username}</div>
      <div class="sub">${fmt(posts.reduce((n,p)=>n+(p.views||0),0))} plays · ${fmt(u.followers.length)} followers · ${fmt(u.following.length)} following</div></div>
    </div>
    <div class="row" style="margin:12px 0;gap:8px">${mine ? `<button class="followwide" id="edit">Edit</button>` : `<button class="followwide" id="pfollow">${me.following.includes(u.id) ? "Following" : requested ? "Requested" : "+ Follow"}</button>`}<button class="playround" id="playall">▶</button></div>
    ${locked ? `<div class="empty">This account is private.</div>` : `<div class="row" style="justify-content:space-between"><b>Posts</b><button class="sub" id="more">More</button></div>
      <div class="hooks">${grid.slice(0, 8).map(p => `<button class="hookcard" data-open="${p.id}">${p.media?.[0] ? `<img src="${p.kind === "video" ? u.avatar : p.media[0]}" style="width:100%;height:100%;object-fit:cover" />` : `<div style="height:100%;background:${p.color}"></div>`}<span>${esc((p.caption || "post").slice(0, 28))}<br>▶ ${fmt(p.views || 0)}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:space-between;margin-top:14px"><b>Recent</b></div>
      ${posts.slice(0, 5).map(p => `<button class="listbtn" data-open="${p.id}"><img src="${u.avatar}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" /><div><b>${esc(p.caption.slice(0, 32))}</b><div class="sub">${p.kind} · ${fmt(p.likes.length)} likes</div></div></button>`).join("")}`}
  </div></section>`);
  $("#back").onclick = () => { profileId = null; render(); };
  $("#sharep") && ($("#sharep").onclick = () => toast("Profile link copied"));
  $("#playall") && ($("#playall").onclick = () => { const first = posts[0]; if (first) { viewer = first.id; render(); } });
  $("#more") && ($("#more").onclick = () => toast("All posts"));
  $("#pmsg") && ($("#pmsg").onclick = () => { tab = "chat"; chatId = ensureConvo([u.id]); render(); });
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { profileMode = b.dataset.m; render(); });
  $("#pfollow") && ($("#pfollow").onclick = () => follow(u.id));
  $("#pmsg") && ($("#pmsg").onclick = () => { tab = "chat"; chatId = ensureConvo([u.id]); render(); });
  $("#pblock") && ($("#pblock").onclick = () => { mutate(db => { const i = db.blocks.findIndex(b => b.by === me.id && b.who === u.id); if (i >= 0) db.blocks.splice(i, 1); else db.blocks.push({ by: me.id, who: u.id }); }); render(); });
  $("#prep") && ($("#prep").onclick = () => { mutate(db => db.reports.push({ id: "rp" + Date.now(), by: me.id, target: u.id, reason: "profile", at: Date.now() })); toast("Reported"); });
  $("#edit") && ($("#edit").onclick = editProfile);
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { viewer = b.dataset.open; render(); });
}
function editProfile() {
  const me = api.me();
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Edit profile</b>
    <input class="field" id="nm" value="${esc(me.name)}" placeholder="Name" />
    <input class="field" id="un" value="${esc(me.username)}" placeholder="username" style="margin-top:8px" />
    <input class="field" id="em" value="${esc(me.email || "")}" placeholder="Email" style="margin-top:8px" />
    <textarea class="field" id="bio" style="margin-top:8px">${esc(me.bio || "")}</textarea>
    <input class="field" id="city" value="${esc(me.city || "")}" placeholder="City" style="margin-top:8px" />
    <button class="btn" id="savep" style="margin-top:10px">Save</button></div>`;
  $("#savep").onclick = () => {
    const username = $("#un").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("Bad username");
    if (api.db().users.some(u => u.username === username && u.id !== me.id)) return toast("Username taken");
    mutate(db => { const u = db.users.find(x => x.id === me.id); Object.assign(u, { name: $("#nm").value.trim(), username, email: $("#em").value.trim(), bio: $("#bio").value.trim(), city: $("#city").value.trim() }); });
    sheet.classList.remove("on"); render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
function postViewer(id) {
  const p = api.db().posts.find(x => x.id === id);
  if (!p) { viewer = null; return profile(profileId); }
  shell(`<section class="screen on"><div class="topbar"><button id="back">←</button><b>@${api.user(p.author).username}</b><span></span></div><div class="feed">${postCard(p)}</div></section>`);
  $("#back").onclick = () => { viewer = null; render(); };
  bindPosts();
}
function ensureConvo(ids) { return makeConvo(ids); }
function chats() {
  openChatList({ shell, toast, esc, ago, app, $: (q) => $(q), render, setChat: (id) => { chatId = id; render(); } });
}
function thread(id) {
  openThread(id, { shell, toast, esc, ago, app, $: (q) => $(q), render, setChat: (id) => { chatId = id; render(); } });
}

function map() {
  const cities = [{ name: "Miami", x: "62%", y: "68%" }, { name: "New York", x: "74%", y: "32%" }, { name: "Chicago", x: "52%", y: "38%" }, { name: "Los Angeles", x: "18%", y: "48%" }];
  if (mapCity) {
    const posts = api.posts().filter(p => (p.location || "") === mapCity);
    shell(`<section class="screen on"><div class="scroll page"><button id="back" class="sub">← Map</button><div class="h1">${mapCity}</div><p class="sub">${posts.length} public posts</p>
      ${posts.map(p => `<button class="listbtn" data-open="${p.id}"><img src="${p.media?.[0] || api.user(p.author).avatar}" style="width:54px;height:54px;object-fit:cover;border-radius:10px" /><div><b>@${api.user(p.author).username}</b> · ${p.kind}<div class="sub">${esc(p.caption)}</div></div></button>`).join("") || `<div class="empty">No public posts here yet. Post with this city to pin it.</div>`}
    </div></section>`);
    $("#back").onclick = () => { mapCity = null; render(); };
    app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { viewer = b.dataset.open; tab = "updates"; profileId = api.db().posts.find(p => p.id === b.dataset.open).author; render(); });
    return;
  }
  shell(`<section class="screen on"><div class="topbar"><div class="word">Map</div><button class="icon" id="near">◎</button></div>
    <div class="mapwrap">${cities.map(c => `<button class="pin" style="left:${c.x};top:${c.y}" data-city="${c.name}"><i>${c.name}<br>${api.posts().filter(p => p.location === c.name).length}</i></button>`).join("")}</div>
  </section>`);
  app.querySelectorAll("[data-city]").forEach(b => b.onclick = () => { mapCity = b.dataset.city; render(); });
  $("#near").onclick = () => { mapCity = api.me().city || "Miami"; render(); };
}

function search() {
  const q = searchQ.toLowerCase().replace("#", "");
  const users = api.db().users.filter(u => u.id !== api.me().id && (!q || u.username.includes(q) || u.name.toLowerCase().includes(q)));
  const posts = api.posts().filter(p => !q || p.caption.toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)) || (p.location || "").toLowerCase().includes(q));
  const tags = [...new Set(api.posts().flatMap(p => p.tags || []))].filter(t => !q || t.includes(q)).slice(0, 8);
  shell(`<section class="screen on"><div class="scroll page"><button class="sub" id="back">← Updates</button><div class="h1">Search</div>
    <input class="search" id="q" placeholder="People, posts, #tags, places" value="${esc(searchQ)}" />
    <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tags.map(t => `<button class="chip" data-tag="${t}">#${t}</button>`).join("")}</div>
    ${users.slice(0, 8).map(u => `<button class="listbtn" data-profile="${u.id}"><img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" /><div><b>@${u.username}</b><div class="sub">${esc(u.bio || u.city || "")}</div></div></button>`).join("")}
    <div class="grid3" style="margin-top:10px">${posts.slice(0, 12).map(p => `<button class="cell" data-open="${p.id}">${p.media?.[0] ? (p.kind === "video" ? `<video src="${p.media[0]}" muted></video>` : `<img src="${p.media[0]}" />`) : `<div class="textpost" style="height:100%"><p style="font-size:12px">${esc(p.caption.slice(0, 30))}</p></div>`}</button>`).join("")}</div>
  </div></section>`);
  $("#back").onclick = () => { tab = "updates"; render(); };
  $("#q").oninput = (e) => { searchQ = e.target.value; render(); $("#q").focus(); };
  app.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { searchQ = b.dataset.tag; render(); });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => { profileId = b.dataset.profile; tab = "updates"; render(); });
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { viewer = b.dataset.open; tab = "updates"; render(); });
}

function notes() {
  const me = api.me();
  const reqs = api.db().requests.filter(r => r.to === me.id);
  mutate(db => db.notes.forEach(n => { if (n.user === me.id) n.read = true; }));
  shell(`<section class="screen on"><div class="scroll page"><button id="back" class="sub">← Updates</button><div class="h1">Notifications</div>
    ${reqs.map(r => `<div class="listbtn"><img src="${api.user(r.from).avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(r.from).username}</b> requested to follow<div class="row"><button class="btn small" data-acc="${r.from}">Accept</button><button class="btn ghost small" data-dec="${r.from}">Decline</button></div></div></div>`).join("")}
    ${api.db().notes.filter(n => n.user === me.id).map(n => `<button class="listbtn" data-note="${n.id}"><img src="${api.user(n.actor)?.avatar || ""}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${api.user(n.actor)?.username || "someone"}</b> ${esc(n.body)}<div class="sub">${ago(n.created)}</div></div></button>`).join("") || `<div class="empty">You’re caught up.</div>`}
  </div></section>`);
  $("#back").onclick = () => { tab = "updates"; render(); };
  app.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { mutate(db => { const from = b.dataset.acc; const meU = db.users.find(u => u.id === me.id); const them = db.users.find(u => u.id === from); if (!meU.followers.includes(from)) meU.followers.push(from); if (!them.following.includes(me.id)) them.following.push(me.id); db.requests = db.requests.filter(r => !(r.from === from && r.to === me.id)); }); render(); });
  app.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { mutate(db => { db.requests = db.requests.filter(r => !(r.from === b.dataset.dec && r.to === me.id)); }); render(); });
  app.querySelectorAll("[data-note]").forEach(b => b.onclick = () => { const n = api.db().notes.find(x => x.id === b.dataset.note); if (n?.post) { viewer = n.post; tab = "updates"; render(); } else if (n?.actor) { profileId = n.actor; tab = "updates"; render(); } });
}

function settings() {
  const me = api.me();
  const blocked = api.db().blocks.filter(b => b.by === me.id);
  shell(`<section class="screen on"><div class="scroll page"><div class="h1">Settings</div>
    <button class="listbtn" id="edit">Account · @${me.username}</button>
    <button class="listbtn" id="pass">Password</button>
    <button class="listbtn" id="priv">Privacy · ${me.private ? "Private" : "Public"} account</button>
    <button class="listbtn" id="blocked">Blocked · ${blocked.length}</button>
    <button class="listbtn" id="notifs">Notifications · on</button>
    <button class="listbtn" id="help">Help · report a problem</button>
    <button class="listbtn" id="about">About · terms and privacy</button>
    <button class="listbtn" id="reset">Reset sample data</button>
    <button class="btn ghost" id="out" style="margin-top:16px">Log out</button>
    <div id="extra"></div>
  </div></section>`);
  $("#out").onclick = () => { api.logout(); render(); };
  $("#edit").onclick = editProfile;
  $("#priv").onclick = () => { mutate(() => { api.me().private = !api.me().private; }); render(); };
  $("#pass").onclick = () => { $("#extra").innerHTML = `<input class="field" id="np" type="password" placeholder="New password" /><button class="btn" id="sp" style="margin-top:8px">Save password</button>`; $("#sp").onclick = () => { if ($("#np").value.length < 6) return toast("6+ characters"); mutate(() => { api.me().password = $("#np").value; }); toast("Password updated"); }; };
  $("#blocked").onclick = () => { $("#extra").innerHTML = blocked.map(b => `<div class="listbtn"><span>@${api.user(b.who)?.username}</span><button data-un="${b.who}">Unblock</button></div>`).join("") || `<div class="sub">No blocked users.</div>`; $("#extra").querySelectorAll("[data-un]").forEach(b => b.onclick = () => { mutate(db => { db.blocks = db.blocks.filter(x => !(x.by === me.id && x.who === b.dataset.un)); }); render(); }); };
  $("#notifs").onclick = () => toast("Likes, comments, follows, and messages stay on");
  $("#help").onclick = () => { mutate(db => db.reports.push({ id: "h" + Date.now(), by: me.id, target: "app", reason: "help", at: Date.now() })); toast("Sent to help"); };
  $("#about").onclick = () => { $("#extra").innerHTML = `<p class="sub" style="margin-top:8px">Old Time is a social feed, chat, and map. Posts you make stay on this device until a server is connected. Be decent.</p>`; };
  $("#reset").onclick = () => { api.reset(); api.login("you@oldtime.app", "oldtime"); render(); };
}

render();
