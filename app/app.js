import { api, mutate, fileToData } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
let tab = "home";
let feedMode = "foryou";
let profileId = null;
let chatId = null;
let createKind = "video";
let pending = [];
let searchQ = "";
let muted = true;

const esc = (s = "") => String(s).replace(/[&<>"]/g, c => ({ "&": "&", "<": "<", ">": ">", '"': """ }[c]));
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n || 0);
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };

const ic = {
  home: `<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  chat: `<svg viewBox="0 0 24 24"><path d="M5 6h14v9H8l-3 3V6z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24"><path d="M5 6h14v10H8l-3 3V6z"/></svg>`,
  share: `<svg viewBox="0 0 24 24"><path d="M12 16V5M8 8l4-4 4 4M6 20h12"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>`
};

function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1400);
}

function shell(inner, light) {
  const unread = api.me() ? api.db().convos.filter(c => c.members.includes(api.me().id) && c.messages.some(m => m.author !== api.me().id && !m.read)).length : 0;
  app.innerHTML = `<div class="stage"><div class="phone ${light ? "light" : ""}">
    ${inner}
    <nav class="nav ${light ? "lightnav" : ""}">
      <button data-tab="home" class="${tab === "home" ? "on" : ""}">${ic.home}</button>
      <button data-tab="search" class="${tab === "search" ? "on" : ""}">${ic.search}</button>
      <button data-tab="create"><span class="create">${ic.plus}</span></button>
      <button data-tab="chat" class="${tab === "chat" ? "on" : ""}">${ic.chat}${unread ? '<i class="dot"></i>' : ""}</button>
      <button data-tab="profile" class="${tab === "profile" && !profileId ? "on" : ""}"><span class="orb"></span></button>
    </nav>
    <div class="toast"></div>
    <div class="sheet" id="sheet"></div>
  </div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    if (b.dataset.tab === "create") return openCreate();
    tab = b.dataset.tab; profileId = null; chatId = null; render();
  });
}

function render() {
  if (!api.me()) return auth();
  if (tab === "home") return home();
  if (tab === "search") return search();
  if (tab === "chat") return chatId ? thread(chatId) : chats();
  if (tab === "profile") return profile(profileId || api.me().id);
  if (tab === "inbox") return inbox();
  home();
}

function auth() {
  app.innerHTML = `<div class="stage"><div class="phone light"><div class="auth">
    <div style="font-size:28px;font-weight:750;letter-spacing:-.03em">Log in</div>
    <input class="field" id="email" placeholder="Email or username" value="you@oldtime.app" />
    <input class="field" id="pass" type="password" placeholder="Password" value="oldtime" />
    <p class="sub" id="err"></p>
    <button class="btn" id="login">Log in</button>
    <button class="btn ghost" id="google">Continue with Google</button>
    <button class="btn ghost" id="apple">Continue with Apple</button>
    <button class="btn ghost" id="signup">Create account</button>
  </div></div></div>`;
  $("#login").onclick = () => { try { api.login($("#email").value.trim(), $("#pass").value); render(); } catch (e) { $("#err").textContent = e.message; } };
  $("#google").onclick = () => { api.oauth("google"); render(); };
  $("#apple").onclick = () => { api.oauth("apple"); render(); };
  $("#signup").onclick = signup;
}

function signup() {
  app.innerHTML = `<div class="stage"><div class="phone light"><div class="auth">
    <div style="font-size:28px;font-weight:750">Create account</div>
    <input class="field" id="su-email" placeholder="Email" />
    <input class="field" id="su-user" placeholder="username" />
    <input class="field" id="su-name" placeholder="Name" />
    <input class="field" id="su-pass" type="password" placeholder="Password" />
    <button class="btn" id="go">Create account</button>
    <button class="btn ghost" id="back">Back</button>
    <p class="sub" id="err"></p>
  </div></div></div>`;
  $("#back").onclick = auth;
  $("#go").onclick = () => {
    try {
      api.signup({ email: $("#su-email").value.trim(), username: $("#su-user").value.trim(), name: $("#su-name").value.trim(), password: $("#su-pass").value });
      render();
    } catch (e) { $("#err").textContent = e.message; }
  };
}

function home() {
  const posts = api.ranked(feedMode);
  const unread = api.db().notes.filter(n => n.user === api.me().id && !n.read).length;
  shell(`<section class="screen on">
    <div class="feed" id="feed">${posts.map(clip).join("") || `<div class="empty">No posts yet.</div>`}</div>
    <div class="topbar" style="position:absolute;left:0;right:0;background:transparent;z-index:3">
      <div class="pills">
        <button data-feed="following" class="${feedMode === "following" ? "on" : ""}">Following</button>
        <button data-feed="foryou" class="${feedMode === "foryou" ? "on" : ""}">For You</button>
      </div>
      <button class="icon" id="bell">${ic.bell}${unread ? '<i class="dot"></i>' : ""}</button>
    </div>
  </section>`);
  $("#bell").onclick = () => { tab = "inbox"; render(); };
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

function clip(p) {
  const u = api.user(p.author);
  const me = api.me();
  const liked = p.likes.includes(me.id);
  const following = me.following.includes(u.id) || u.id === me.id;
  const media = p.kind === "video"
    ? `<video src="${p.media[0]}" data-id="${p.id}" loop playsinline ${muted ? "muted" : ""}></video>`
    : p.kind === "text"
      ? `<div class="fullimg" style="display:grid;place-items:center;padding:32px;background:${p.color || "#111"};font-size:28px;font-weight:700;text-align:center">${esc(p.caption)}</div>`
      : `<img class="fullimg" src="${p.media[0]}" alt="" />`;
  return `<article class="clip">${media}<div class="shade"></div>
    <div class="rail">
      <button class="act ${liked ? "on" : ""}" data-like="${p.id}">${ic.heart}<span>${fmt(p.likes.length)}</span></button>
      <button class="act" data-comment="${p.id}">${ic.comment}<span>${fmt(p.comments.length)}</span></button>
      <button class="act" data-share="${p.id}">${ic.share}<span>${fmt(p.shares || 0)}</span></button>
    </div>
    <div class="meta">
      <img class="avatar" src="${u.avatar}" alt="" data-profile="${u.id}" />
      <button class="handle" data-profile="${u.id}">${esc(u.username)}</button>
      ${following ? "" : `<button class="followpill" data-follow="${u.id}">Follow</button>`}
    </div>
    ${p.kind === "text" ? "" : `<div class="capline">${esc(p.caption || "")}</div>`}
  </article>`;
}

function bindPosts() {
  app.querySelectorAll("[data-like]").forEach(b => b.onclick = (e) => { e.stopPropagation(); like(b.dataset.like); });
  app.querySelectorAll("[data-comment]").forEach(b => b.onclick = (e) => { e.stopPropagation(); comments(b.dataset.comment); });
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = (e) => { e.stopPropagation(); share(b.dataset.share); });
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = (e) => { e.stopPropagation(); follow(b.dataset.follow); });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = (e) => { e.stopPropagation(); profileId = b.dataset.profile; tab = "profile"; render(); });
  app.querySelectorAll(".clip video").forEach(v => v.onclick = () => { v.paused ? v.play() : v.pause(); });
}

function like(id) {
  const me = api.me();
  mutate(db => {
    const p = db.posts.find(x => x.id === id);
    const i = p.likes.indexOf(me.id);
    if (i >= 0) p.likes.splice(i, 1);
    else {
      p.likes.push(me.id);
      if (p.author !== me.id) db.notes.unshift({ id: "n" + Date.now(), user: p.author, kind: "like", actor: me.id, post: id, body: "liked your post", created: Date.now(), read: false });
    }
  });
  render();
}
function follow(id) {
  const me = api.me();
  mutate(db => {
    const meU = db.users.find(x => x.id === me.id);
    const them = db.users.find(x => x.id === id);
    if (meU.following.includes(id)) {
      meU.following = meU.following.filter(x => x !== id);
      them.followers = them.followers.filter(x => x !== me.id);
    } else {
      meU.following.push(id); them.followers.push(me.id);
      db.notes.unshift({ id: "n" + Date.now(), user: id, kind: "follow", actor: me.id, body: "started following you", created: Date.now(), read: false });
    }
  });
  render();
}
function share(id) {
  navigator.clipboard?.writeText(location.origin + "/p/" + id);
  mutate(db => { const p = db.posts.find(x => x.id === id); p.shares = (p.shares || 0) + 1; });
  toast("Link copied");
}
function watch(id) { mutate(db => { const p = db.posts.find(x => x.id === id); if (p) p.views = (p.views || 0) + 1; }); }

function comments(id) {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  const draw = () => {
    const p = api.db().posts.find(x => x.id === id);
    sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Comments</b>
      <div id="clist" style="margin:12px 0;max-height:46vh;overflow:auto">${p.comments.map(c => `<div class="row" style="align-items:flex-start;margin:10px 0"><img src="${api.user(c.author).avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover" /><div><b>${esc(api.user(c.author).username)}</b> ${esc(c.body)}<div class="sub">${ago(c.created)}</div></div></div>`).join("") || `<div class="sub">No comments yet.</div>`}</div>
      <form id="cform" class="row"><input class="field" id="cbody" placeholder="Add a comment" /><button class="btn small" type="submit">Send</button></form></div>`;
    $("#cform").onsubmit = (e) => {
      e.preventDefault();
      const body = $("#cbody").value.trim(); if (!body) return;
      mutate(db => db.posts.find(x => x.id === id).comments.push({ id: "c" + Date.now(), author: api.me().id, body, likes: [], replies: [], created: Date.now() }));
      draw();
    };
    sheet.onclick = (e) => { if (e.target === sheet) { sheet.classList.remove("on"); render(); } };
  };
  draw();
}

function search() {
  const q = searchQ.toLowerCase();
  const people = api.db().users.filter(u => !q || u.username.includes(q) || u.name.toLowerCase().includes(q));
  const posts = api.db().posts.filter(p => !q || (p.caption || "").toLowerCase().includes(q));
  shell(`<section class="screen on"><div class="scroll page">
    <input class="search" id="q" placeholder="Search" value="${esc(searchQ)}" />
    ${people.map(u => `<button class="listbtn" data-profile="${u.id}"><img class="avatar" src="${u.avatar}" alt="" /><span><b>${esc(u.name)}</b><div class="sub">@${esc(u.username)}</div></span></button>`).join("")}
    <div class="grid3" style="margin-top:12px">${posts.map(p => `<button class="cell" data-profile="${p.author}">${p.kind === "text" ? `<div style="height:100%;display:grid;place-items:center;padding:8px;font-size:12px">${esc(p.caption)}</div>` : `<img src="${p.kind === "video" ? api.user(p.author).avatar : p.media[0]}" alt="" />`}</button>`).join("")}</div>
  </div></section>`);
  $("#q").oninput = (e) => { searchQ = e.target.value; render(); };
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => { profileId = b.dataset.profile; tab = "profile"; render(); });
}

function chats() {
  const me = api.me();
  const rows = api.db().convos.filter(c => c.members.includes(me.id));
  shell(`<section class="screen on"><div class="scroll" style="padding:8px 16px 96px">
    <div class="topbar" style="padding:8px 0 4px">
      <span></span>
      <b>Chats</b>
      <button class="icon" id="newc" style="background:#f2f2f4;color:#111">${ic.plus}</button>
    </div>
    <input class="search chatsearch" id="cq" placeholder="Search" />
    ${rows.map(c => {
      const other = c.members.filter(id => id !== me.id).map(id => api.user(id));
      const last = c.messages[c.messages.length - 1];
      const unread = c.messages.filter(m => m.author !== me.id && !m.read).length;
      return `<button class="chatrow" data-chat="${c.id}">
        <img src="${other[0]?.avatar || ""}" alt="" />
        <span><b>${esc(c.title || other.map(u => u.name).join(", "))}</b><div class="sub">${esc(last?.body || "Say hi")}</div></span>
        <span style="text-align:right"><div class="sub">${last ? ago(last.created) : ""}</div>${unread ? `<div class="unread">${unread}</div>` : ""}</span>
      </button>`;
    }).join("") || `<div class="empty">No chats yet.</div>`}
  </div></section>`, true);
  $("#newc").onclick = newChat;
  app.querySelectorAll("[data-chat]").forEach(b => b.onclick = () => { chatId = b.dataset.chat; render(); });
}

function newChat() {
  const me = api.me();
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>New chat</b>
    ${api.db().users.filter(u => u.id !== me.id).map(u => `<button class="listbtn" data-u="${u.id}"><img class="avatar" src="${u.avatar}" alt="" /><span>${esc(u.name)}</span></button>`).join("")}
  </div>`;
  sheet.querySelectorAll("[data-u]").forEach(b => b.onclick = () => {
    const id = b.dataset.u;
    let c = api.db().convos.find(x => x.members.length === 2 && x.members.includes(me.id) && x.members.includes(id));
    if (!c) mutate(db => db.convos.push({ id: "cv" + Date.now(), members: [me.id, id], messages: [] }));
    c = api.db().convos.find(x => x.members.length === 2 && x.members.includes(me.id) && x.members.includes(id));
    chatId = c.id; sheet.classList.remove("on"); render();
  });
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function thread(id) {
  const me = api.me();
  const c = api.db().convos.find(x => x.id === id);
  if (!c) { chatId = null; return chats(); }
  const other = api.user(c.members.find(x => x !== me.id));
  mutate(db => db.convos.find(x => x.id === id).messages.forEach(m => { if (m.author !== me.id) m.read = true; }));
  shell(`<section class="screen on" style="background:#fff;color:#111">
    <div class="topbar">
      <button id="back">${ic.back}</button>
      <button class="row" id="who"><img class="avatar" src="${other.avatar}" alt="" /><div><b>${esc(other.name)}</b><div class="sub">@${esc(other.username)}</div></div></button>
      <span></span>
    </div>
    <div class="scroll" style="padding:12px 16px 88px">${c.messages.map(m => `<div class="bubble-msg ${m.author === me.id ? "mine" : "theirs"}">${esc(m.body)}</div>`).join("")}</div>
    <form class="msgdock" id="send" style="display:flex;gap:8px;align-items:center"><input id="body" placeholder="Message" style="flex:1;border:0;background:transparent;outline:none;color:#111" /><button type="submit" style="font-weight:750;color:#111">Send</button></form>
  </section>`, true);
  $("#back").onclick = () => { chatId = null; tab = "chat"; render(); };
  $("#who").onclick = () => { profileId = other.id; tab = "profile"; render(); };
  $("#send").onsubmit = (e) => {
    e.preventDefault();
    const body = $("#body").value.trim(); if (!body) return;
    mutate(db => db.convos.find(x => x.id === id).messages.push({ id: "m" + Date.now(), author: me.id, body, created: Date.now(), read: true }));
    render();
  };
}

function profile(id) {
  const u = api.user(id);
  const me = api.me();
  if (!u) { profileId = null; tab = "home"; return home(); }
  const mine = u.id === me.id;
  const posts = api.db().posts.filter(p => p.author === u.id);
  const following = me.following.includes(u.id);
  shell(`<section class="screen on"><div class="scroll page">
    <div class="topbar" style="padding:8px 0">${mine ? "<span></span>" : `<button id="back">${ic.back}</button>`}<b>${esc(u.username)}</b><span></span></div>
    <div class="row" style="align-items:center">
      <img src="${u.avatar}" alt="" style="width:86px;height:86px;border-radius:50%;object-fit:cover" />
      <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);text-align:center">
        <div><b>${posts.length}</b><div class="sub">Posts</div></div>
        <div><b>${fmt(u.followers.length)}</b><div class="sub">Followers</div></div>
        <div><b>${fmt(u.following.length)}</b><div class="sub">Following</div></div>
      </div>
    </div>
    <div style="margin:12px 0"><b>${esc(u.name)}</b><div class="sub">${esc(u.bio || "")}</div></div>
    <div class="row" style="gap:8px;margin-bottom:14px">
      ${mine
        ? `<button class="editbar" id="edit">Edit profile</button>`
        : `<button class="followwide" id="follow">${following ? "Following" : "Follow"}</button><button class="playround" id="msg">${ic.chat}</button>`}
    </div>
    <div class="grid3">${posts.map(p => `<button class="cell" data-open="1">${p.kind === "text" ? `<div style="height:100%;display:grid;place-items:center;padding:8px;font-size:13px;font-weight:700">${esc(p.caption)}</div>` : `<img src="${p.kind === "video" ? u.avatar : p.media[0]}" alt="" />`}</button>`).join("") || `<div class="empty">No posts yet.</div>`}</div>
    ${mine ? `<button class="listbtn" id="out" style="margin-top:18px">Log out</button>` : ""}
  </div></section>`);
  if ($("#back")) $("#back").onclick = () => { profileId = null; tab = "home"; render(); };
  if ($("#follow")) $("#follow").onclick = () => follow(u.id);
  if ($("#msg")) $("#msg").onclick = () => openDm(u.id);
  if ($("#edit")) $("#edit").onclick = editProfile;
  if ($("#out")) $("#out").onclick = () => { api.logout(); render(); };
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { tab = "home"; feedMode = "foryou"; render(); });
}

function openDm(id) {
  const me = api.me();
  let c = api.db().convos.find(x => x.members.length === 2 && x.members.includes(me.id) && x.members.includes(id));
  if (!c) mutate(db => db.convos.push({ id: "cv" + Date.now(), members: [me.id, id], messages: [] }));
  c = api.db().convos.find(x => x.members.length === 2 && x.members.includes(me.id) && x.members.includes(id));
  chatId = c.id; tab = "chat"; render();
}

function editProfile() {
  const me = api.me();
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Edit profile</b>
    <input class="field" id="nm" value="${esc(me.name)}" style="margin-top:12px" />
    <input class="field" id="bio" value="${esc(me.bio || "")}" placeholder="Bio" style="margin-top:8px" />
    <button class="btn" id="save" style="margin-top:12px">Save</button></div>`;
  $("#save").onclick = () => { mutate(() => { const u = api.me(); u.name = $("#nm").value.trim() || u.name; u.bio = $("#bio").value.trim(); }); sheet.classList.remove("on"); render(); };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function inbox() {
  const me = api.me();
  const notes = api.db().notes.filter(n => n.user === me.id);
  mutate(db => db.notes.forEach(n => { if (n.user === me.id) n.read = true; }));
  shell(`<section class="screen on"><div class="scroll page">
    <div class="topbar" style="padding:8px 0"><button id="back">${ic.back}</button><b>Activity</b><span></span></div>
    ${notes.map(n => { const a = api.user(n.actor); return `<div class="listbtn"><img class="avatar" src="${a?.avatar || ""}" alt="" /><span><b>${esc(a?.username || "")}</b> ${esc(n.body)}</span></div>`; }).join("") || `<div class="empty">You're caught up.</div>`}
  </div></section>`);
  $("#back").onclick = () => { tab = "home"; render(); };
}

function openCreate() {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  pending = [];
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>New post</b>
    <div class="seg" id="kinds">
      <button data-k="video">Video</button><button data-k="photo">Photo</button><button data-k="text">Text</button>
    </div>
    <textarea class="field" id="cap" placeholder="Write a caption"></textarea>
    <div class="row" style="margin:10px 0"><button class="btn ghost small" id="pick">Upload</button><input id="file" type="file" accept="image/*,video/*" hidden /><span class="sub" id="picked">No file yet</span></div>
    <button class="btn" id="post">Post</button></div>`;
  const paint = () => sheet.querySelectorAll("#kinds button").forEach(b => b.classList.toggle("on", b.dataset.k === createKind));
  paint();
  sheet.querySelectorAll("#kinds button").forEach(b => b.onclick = () => { createKind = b.dataset.k; paint(); });
  $("#pick").onclick = () => $("#file").click();
  $("#file").onchange = async () => {
    const f = $("#file").files[0]; if (!f) return;
    pending = [await fileToData(f)];
    $("#picked").textContent = f.name;
    if (f.type.startsWith("video")) createKind = "video";
    else if (f.type.startsWith("image")) createKind = "photo";
    paint();
  };
  $("#post").onclick = () => {
    const me = api.me();
    const caption = $("#cap").value.trim();
    if (createKind !== "text" && !pending.length) return toast("Add a file");
    if (createKind === "text" && !caption) return toast("Write something");
    mutate(db => db.posts.unshift({
      id: "p" + Date.now(), author: me.id, kind: createKind, caption, tags: [],
      media: pending.map(x => x.url), sound: "", location: me.city || "",
      likes: [], comments: [], saves: [], created: Date.now(), views: 0, shares: 0,
      color: "#111"
    }));
    sheet.classList.remove("on");
    tab = "home";
    toast("Posted");
    render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

render();
