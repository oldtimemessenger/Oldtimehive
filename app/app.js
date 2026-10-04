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
let playlist = [];

const esc = (s = "") => String(s).replace(/[&<>"]/g, c => ({ "&": "&", "<": "<", ">": ">", '"': """ }[c]));
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n || 0);
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };
const dur = (p) => p.kind === "video" ? "0:24" : "0:15";

const ic = {
  play: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 9l6 3-6 3V9z" fill="currentColor" stroke="none"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>`,
  note: `<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="7" cy="18" r="2.2" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  lib: `<svg viewBox="0 0 24 24"><path d="M5 5h2v14H5zM11 5h2v14h-2zM17 5h2v14h-2z"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/></svg>`,
  chat: `<svg viewBox="0 0 24 24"><path d="M5 6h14v10H8l-3 3V6z"/></svg>`,
  share: `<svg viewBox="0 0 24 24"><path d="M12 16V5M8 8l4-4 4 4M6 20h12"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`
};

function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1400);
}

function shell(inner, light) {
  app.innerHTML = `<div class="stage"><div class="phone ${light ? "light" : ""}">
    ${inner}
    <nav class="nav ${light ? "lightnav" : ""}">
      <button data-tab="home" class="${tab === "home" ? "on" : ""}">${ic.play}</button>
      <button data-tab="search" class="${tab === "search" ? "on" : ""}">${ic.search}</button>
      <button data-tab="create"><span class="create">${ic.note}</span></button>
      <button data-tab="library" class="${tab === "library" ? "on" : ""}">${ic.lib}</button>
      <button data-tab="profile" class="${tab === "profile" && !profileId ? "on" : ""}"><span class="orb"></span></button>
    </nav>
    <div class="toast"></div>
    <div class="sheet" id="sheet"></div>
    <div class="storyview" id="storyview"></div>
  </div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    tab = b.dataset.tab; profileId = null; chatId = null; render();
  });
  $("[data-tab='create']").onclick = () => openCreate();
}

function render() {
  if (!api.me()) return auth();
  if (tab === "home") return home();
  if (tab === "search") return search();
  if (tab === "library") return library();
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
    <div class="feed" id="feed">${posts.map(clip).join("") || `<div class="empty">Nothing here yet.</div>`}</div>
    <div class="topbar" style="position:absolute;left:0;right:0;background:transparent;z-index:3">
      <div class="pills">
        <button data-feed="foryou" class="${feedMode === "foryou" ? "on" : ""}">For You</button>
        <button data-feed="following" class="${feedMode === "following" ? "on" : ""}">Following</button>
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
      ? `<div class="fullimg" style="background:${p.color || "#111"}"></div>`
      : `<img class="fullimg" src="${p.media[0]}" alt="" />`;
  return `<article class="clip">${media}<div class="shade"></div>
    <div class="rail">
      <button class="act ${liked ? "on" : ""}" data-like="${p.id}">${ic.heart}<span>${fmt(p.likes.length)}</span></button>
      <button class="act" data-comment="${p.id}">${ic.chat}<span>${fmt(p.comments.length)}</span></button>
      <button class="act" data-share="${p.id}">${ic.share}<span>${fmt(p.shares || 0)}</span></button>
    </div>
    <div class="meta">
      <img class="avatar" src="${u.avatar}" alt="" data-profile="${u.id}" />
      <button class="handle" data-profile="${u.id}">${esc(u.username)}</button>
      ${following ? "" : `<button class="followpill" data-follow="${u.id}">Follow</button>`}
    </div>
    <div class="soundbar">
      <img src="${u.avatar}" alt="" />
      <div><b>${esc((p.sound || u.name).toUpperCase())}</b><div class="sub">▶ ${fmt(p.views || 0)}</div></div>
      <button class="remix" data-save="${p.id}">＋</button>
      <button class="remix" data-share="${p.id}">Remix</button>
    </div>
  </article>`;
}

function bindPosts() {
  app.querySelectorAll("[data-like]").forEach(b => b.onclick = (e) => { e.stopPropagation(); like(b.dataset.like); });
  app.querySelectorAll("[data-save]").forEach(b => b.onclick = (e) => { e.stopPropagation(); save(b.dataset.save); toast("Saved"); });
  app.querySelectorAll("[data-comment]").forEach(b => b.onclick = (e) => { e.stopPropagation(); comments(b.dataset.comment); });
  app.querySelectorAll("[data-share]").forEach(b => b.onclick = (e) => { e.stopPropagation(); share(b.dataset.share); });
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = (e) => { e.stopPropagation(); follow(b.dataset.follow); });
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = (e) => { e.stopPropagation(); profileId = b.dataset.profile; tab = "profile"; render(); });
  app.querySelectorAll(".clip video").forEach(v => v.onclick = () => { if (v.paused) v.play(); else v.pause(); });
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
function save(id) {
  const me = api.me();
  mutate(db => { const p = db.posts.find(x => x.id === id); const i = p.saves.indexOf(me.id); if (i >= 0) p.saves.splice(i, 1); else p.saves.push(me.id); });
  if (!playlist.includes(id)) playlist.push(id);
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
  const link = location.origin + "/p/" + id;
  navigator.clipboard?.writeText(link);
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
      <form id="cform" class="row"><input class="field" id="cbody" placeholder="Message" /><button class="btn small" type="submit">Send</button></form></div>`;
    $("#cform").onsubmit = (e) => {
      e.preventDefault();
      const body = $("#cbody").value.trim(); if (!body) return;
      mutate(db => {
        const post = db.posts.find(x => x.id === id);
        post.comments.push({ id: "c" + Date.now(), author: api.me().id, body, likes: [], replies: [], created: Date.now() });
      });
      draw();
    };
    sheet.onclick = (e) => { if (e.target === sheet) { sheet.classList.remove("on"); render(); } };
  };
  draw();
}

function library() {
  const me = api.me();
  const mine = api.db().posts.filter(p => p.author === me.id || p.likes.includes(me.id) || p.saves.includes(me.id));
  shell(`<section class="screen on"><div class="scroll page">
    <div class="topbar" style="padding:8px 0">
      <div class="h1">Library</div>
      <div class="row">
        <button class="icon" id="go-search">${ic.search}</button>
        <button class="icon" id="go-bell">${ic.bell}</button>
      </div>
    </div>
    <div class="libcards">
      <button class="libcard" id="liked" style="background:linear-gradient(160deg,#2f6bff,#39d98a)">${ic.heart}Liked</button>
      <button class="libcard" id="lists" style="background:linear-gradient(160deg,#6a3cff,#ff7a3c)">Playlists</button>
      <button class="libcard" id="msgs" style="background:linear-gradient(160deg,#1faa59,#7dffb0)">${ic.chat}Messages</button>
    </div>
    <div class="sec"><b>My Songs</b><button class="filter" id="filter">Filter</button></div>
    <div id="songs">${songRows(mine)}</div>
  </div></section>`);
  $("#go-search").onclick = () => { tab = "search"; render(); };
  $("#go-bell").onclick = () => { tab = "inbox"; render(); };
  $("#msgs").onclick = () => { tab = "chat"; render(); };
  $("#liked").onclick = () => { $("#songs").innerHTML = songRows(api.db().posts.filter(p => p.likes.includes(me.id))); };
  $("#lists").onclick = () => { $("#songs").innerHTML = songRows(api.db().posts.filter(p => playlist.includes(p.id) || p.saves.includes(me.id))); };
  $("#filter").onclick = () => toast("Newest");
  bindSongs();
}

function songRows(list) {
  if (!list.length) return `<div class="empty">Nothing saved yet.</div>`;
  return list.map(p => {
    const u = api.user(p.author);
    const src = p.media?.[0] || u.avatar;
    return `<button class="song" data-open="${p.id}">
      <span style="position:relative"><img class="thumb" src="${p.kind === "video" ? u.avatar : src}" alt="" /><span class="dur">${dur(p)}</span></span>
      <span><b>${esc(u.name)}</b></span>
      <span class="more">···</span>
    </button>`;
  }).join("");
}
function bindSongs() {
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { tab = "home"; render(); });
}

function search() {
  const q = searchQ.toLowerCase();
  const people = api.db().users.filter(u => !q || u.username.includes(q) || u.name.toLowerCase().includes(q));
  shell(`<section class="screen on"><div class="scroll page">
    <input class="search" id="q" placeholder="Search" value="${esc(searchQ)}" />
    ${people.map(u => `<button class="listbtn" data-profile="${u.id}"><img class="avatar" src="${u.avatar}" alt="" /><span><b>${esc(u.name)}</b><div class="sub">@${esc(u.username)}</div></span></button>`).join("")}
  </div></section>`);
  $("#q").oninput = (e) => { searchQ = e.target.value; render(); };
  app.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => { profileId = b.dataset.profile; tab = "profile"; render(); });
}

function chats() {
  const me = api.me();
  const rows = api.db().convos.filter(c => c.members.includes(me.id));
  shell(`<section class="screen on"><div class="scroll" style="padding:8px 16px 96px">
    <div class="topbar" style="padding:8px 0 4px">
      <button class="sub" id="edit">Edit</button>
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
        <span><b>${esc(c.title || other.map(u => u.name).join(", "))}</b><div class="sub">${esc(last?.body || "")}</div></span>
        <span style="text-align:right"><div class="sub">${ago(last?.created)}</div>${unread ? `<div class="unread">${unread}</div>` : ""}</span>
      </button>`;
    }).join("") || `<div class="empty">No chats yet.</div>`}
  </div></section>`, true);
  $("#newc").onclick = () => toast("Pick someone from Search");
  $("#edit").onclick = () => toast("Edit");
  app.querySelectorAll("[data-chat]").forEach(b => b.onclick = () => { chatId = b.dataset.chat; render(); });
}

function thread(id) {
  const me = api.me();
  const c = api.db().convos.find(x => x.id === id);
  if (!c) { chatId = null; return chats(); }
  const other = api.user(c.members.find(x => x !== me.id));
  shell(`<section class="screen on" style="background:#fff;color:#111">
    <div class="topbar">
      <button id="back">${ic.back}</button>
      <div class="row"><img class="avatar" src="${other.avatar}" alt="" /><div><b>${esc(other.name)}</b><div class="sub">@${esc(other.username)}</div></div></div>
      <span></span>
    </div>
    <div class="scroll" id="msgs" style="padding:12px 16px 88px">${c.messages.map(m => `<div class="bubble-msg ${m.author === me.id ? "mine" : "theirs"}">${esc(m.body)}</div>`).join("")}</div>
    <form class="msgdock" id="send" style="display:flex;gap:8px;align-items:center"><input id="body" placeholder="Message..." style="flex:1;border:0;background:transparent;outline:none;color:#111" /><button type="submit" style="font-weight:750;color:#111">Send</button></form>
  </section>`, true);
  $("#back").onclick = () => { chatId = null; tab = "chat"; render(); };
  $("#send").onsubmit = (e) => {
    e.preventDefault();
    const body = $("#body").value.trim(); if (!body) return;
    mutate(db => { db.convos.find(x => x.id === id).messages.push({ id: "m" + Date.now(), author: me.id, body, created: Date.now(), read: true }); });
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
  const cover = posts[0]?.media?.[0] || u.avatar;
  shell(`<section class="screen on"><div class="scroll">
    <div class="coverwrap">
      ${mine ? "" : `<button class="backabs" id="back">${ic.back}</button>`}
      <img class="cover" src="${cover}" alt="" />
    </div>
    <div class="profhead">
      <img src="${u.avatar}" alt="" />
      <div>
        <div style="font-size:22px;font-weight:750">${esc(u.name)}</div>
        <div class="sub">@${esc(u.username)}</div>
        <div class="sub">${fmt(u.followers.length)} followers · ${posts.length} posts</div>
      </div>
    </div>
    <div class="row" style="padding:14px 16px;gap:8px">
      ${mine
        ? `<button class="editbar" id="edit">Edit Profile</button>`
        : `<button class="followwide" id="follow">${following ? "Following" : "Follow"}</button><button class="playround" id="msg">${ic.chat}</button>`}
    </div>
    <div class="page" style="padding-top:0">
      <div class="sec"><b>Hooks</b></div>
      <div class="hooks">${posts.slice(0, 6).map(p => `<button class="hookcard" data-open="${p.id}"><img src="${p.kind === "video" ? u.avatar : (p.media[0] || u.avatar)}" alt="" /><i>▶ ${fmt(p.views || 0)}</i></button>`).join("") || `<div class="sub">No posts yet.</div>`}</div>
      <div class="sec" style="margin-top:18px"><b>Recent</b></div>
      <div class="grid3">${posts.map(p => `<button class="cell" data-open="${p.id}">${p.kind === "video" ? `<img src="${u.avatar}" alt="" />` : `<img src="${p.media[0]}" alt="" />`}</button>`).join("")}</div>
      ${mine ? `<div class="sec" style="margin-top:18px"><b>Creators to Follow</b></div>
        <div class="people">${api.db().users.filter(x => x.id !== me.id && !me.following.includes(x.id)).slice(0, 6).map(x => `<div class="person"><img src="${x.avatar}" alt="" /><b>${esc(x.name)}</b><button class="lightbtn" data-follow="${x.id}" style="margin-top:8px">Follow</button></div>`).join("")}</div>
        <button class="listbtn" id="out" style="margin-top:18px">Log out</button>` : ""}
    </div>
  </div></section>`);
  if ($("#back")) $("#back").onclick = () => { profileId = null; tab = "home"; render(); };
  if ($("#follow")) $("#follow").onclick = () => follow(u.id);
  if ($("#msg")) $("#msg").onclick = () => {
    let c = api.db().convos.find(x => x.members.includes(me.id) && x.members.includes(u.id) && x.members.length === 2);
    if (!c) { mutate(db => { c = { id: "cv" + Date.now(), members: [me.id, u.id], messages: [] }; db.convos.push(c); }); c = api.db().convos.find(x => x.members.includes(u.id) && x.members.length === 2); }
    chatId = c.id; tab = "chat"; render();
  };
  if ($("#edit")) $("#edit").onclick = editProfile;
  if ($("#out")) $("#out").onclick = () => { api.logout(); render(); };
  app.querySelectorAll("[data-follow]").forEach(b => b.onclick = () => follow(b.dataset.follow));
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { tab = "home"; render(); });
}

function editProfile() {
  const me = api.me();
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Edit profile</b>
    <input class="field" id="nm" value="${esc(me.name)}" style="margin-top:12px" />
    <input class="field" id="bio" value="${esc(me.bio || "")}" placeholder="Bio" style="margin-top:8px" />
    <input class="field" id="city" value="${esc(me.city || "")}" placeholder="City" style="margin-top:8px" />
    <button class="btn" id="save" style="margin-top:12px">Save</button></div>`;
  $("#save").onclick = () => { mutate(() => { const u = api.me(); u.name = $("#nm").value.trim() || u.name; u.bio = $("#bio").value.trim(); u.city = $("#city").value.trim(); }); sheet.classList.remove("on"); render(); };
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
    <input class="field" id="snd" placeholder="Sound name" style="margin-top:8px" />
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
  };
  $("#post").onclick = () => {
    const me = api.me();
    const caption = $("#cap").value.trim();
    const sound = $("#snd").value.trim();
    if (createKind !== "text" && !pending.length) return toast("Add a file");
    mutate(db => db.posts.unshift({
      id: "p" + Date.now(), author: me.id, kind: createKind, caption, tags: [],
      media: pending.map(x => x.url), sound: sound || "Original audio", location: me.city || "",
      likes: [], comments: [], saves: [], created: Date.now(), views: 0, shares: 0,
      color: "linear-gradient(160deg,#111,#333)"
    }));
    sheet.classList.remove("on");
    tab = "home";
    toast("Posted");
    render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

render();
