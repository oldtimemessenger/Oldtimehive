import { api, mutate, fileToData, notify } from "./store.js";
import { ensureConvo as makeConvo, openChatList, openThread, closeChatTimers } from "./chat.js";
import { openLive } from "./live.js";
import { mountComms, closeVoiceNote } from "./comms/index.js";
import { icons as ic, icon } from "./icons.js";
import { openEmojiPicker, closeEmojiPicker } from "./emoji.js";
import { leaveLive } from "./live.js";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
app.addEventListener("error", event => {
  const media = event.target;
  if (media.tagName === "IMG" && !media.dataset.fallback) {
    media.dataset.fallback = "true";
    media.src = new URL("./avatar.svg", import.meta.url).href;
  }
  if ((media.tagName === "VIDEO" || media.classList?.contains("fullimg")) && media.closest(".clip") && !media.parentElement.querySelector(".media-fallback")) {
    const notice = document.createElement("div");
    notice.className = "media-fallback";
    notice.textContent = "Media unavailable. Check your connection.";
    media.parentElement.appendChild(notice);
  }
}, true);
let tab = "updates";
let feedMode = "foryou";
let profileId = null;
let profileMode = "posts";
let storyTimer = null;
let createKind = "video";
let pending = [];
let chatId = null;
let searchQ = "";
let carouselIndex = {};
let muted = true;
let viewer = null;
let profileMore = false;

let feedObserver = null;
const watchedPosts = new Set();

const esc = (s = "") => String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n || 0);
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };

function copyText(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  ta.remove();
  return copied;
}
function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1600);
}
function shell(inner, mode) {
  closeEmojiPicker();
  const conversation = $("#msgs")?.dataset.convo;
  closeVoiceNote(!conversation || !inner.includes(`data-convo="${conversation}"`));
  closeChatTimers();
  clearInterval(storyTimer);
  feedObserver?.disconnect();
  const light = mode === "light";
  app.innerHTML = `<div class="stage"><div class="phone ${light ? "light" : ""}">
    ${inner}
    <nav class="nav ${light ? "lightnav" : ""}">
      <button data-tab="updates" aria-label="Home" class="${tab === "updates" && !profileId ? "on" : ""}">${ic.home}</button>
      <button id="create-open" aria-label="Create"><span class="fab">${ic.plus}</span></button>
      <button data-tab="chat" aria-label="Chat" class="${tab === "chat" ? "on" : ""}">${ic.comment}</button>
      <button data-tab="profile" aria-label="Profile" class="${profileId === api.me().id ? "on" : ""}">${ic.user}</button>
    </nav>
    <div class="toast" role="status"></div>
    <div class="sheet" id="sheet"></div>
    <div class="storyview" id="storyview"></div>
  </div></div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
    leaveLive();
    tab = b.dataset.tab;
    viewer = null;
    if (tab === "profile") { profileId = api.me().id; tab = "updates"; profileMode = "posts"; }
    else { chatId = null; profileId = null; viewer = null; }
    render();
  });
  $("#create-open").onclick = () => {
    leaveLive();
    if ($("#ftback") || $("#live-back")) render();
    openCreate();
  };
  app.querySelectorAll('#back, #ftback, #playall').forEach(button => {
    const symbols = { "←": ["back", "Back"], "✕": ["close", "Close"], "▶": ["play", "Play"] };
    const replacement = symbols[button.textContent.trim()];
    if (replacement) { button.innerHTML = icon(replacement[0]); button.setAttribute("aria-label", replacement[1]); }
  });
}
function render() {
  if (!api.me()) return auth();
  mountComms({ toast, esc });
  if (viewer) return postViewer(viewer);
  if (tab === "updates" && profileId) return profile(profileId);
  if (tab === "updates") return updates();
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
    <p class="sub">Local demo · accounts and posts stay in this browser.</p>
    <input class="field" id="email" placeholder="Email or username" value="you@oldtime.app" />
    <input class="field" id="pass" type="password" placeholder="Password" value="oldtime" />
    <p class="sub" id="err"></p>
    <button class="btn" id="login">Log in</button>
    <button class="btn ghost" id="google">Try Google demo account</button>
    <button class="btn ghost" id="apple">Try Apple demo account</button>
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
    <div class="word">Account recovery</div>
    <p class="sub">Email verification is not connected in this local demo. A verified recovery link is required before resetting a password. You can change your password in Settings while signed in.</p>
    <button class="btn ghost" id="back">Back</button>
  </div></div></div>`;
  $("#back").onclick = auth;
}

function updates() {
  const previousFeed = $("#feed");
  const activePost = previousFeed?.children[Math.round(previousFeed.scrollTop / (previousFeed.clientHeight || 1))]?.dataset.id;
  const me = api.me();
  const stories = api.db().stories.filter(s => Date.now() - s.created < 864e5 && api.canSeePost(s));
  const byAuthor = new Map();
  stories.forEach(s => { if (!byAuthor.has(s.author)) byAuthor.set(s.author, s); });
  const posts = api.ranked(feedMode);
  const unread = api.db().notes.filter(n => n.user === me.id && !n.read).length;
  shell(`<section class="screen on">
    <div class="feed" id="feed">${posts.map(postCard).join("") || `<div class="empty">Nothing in this feed yet.</div>`}</div>
    <div class="topbar" style="position:absolute;left:0;right:12px;background:transparent">
      <div class="pills"><button data-feed="foryou" class="${feedMode === "foryou" ? "on" : ""}">For You</button><button data-feed="following" class="${feedMode === "following" ? "on" : ""}">Following</button></div>
      <span class="row">
        <button class="icon" id="golive" aria-label="Live camera preview">${ic.video}</button>
        <button class="icon" id="findposts" aria-label="Search">${ic.search}</button>
        <button class="icon" id="bell" aria-label="Notifications">${ic.bell}${unread ? '<i class="badge"></i>' : ""}</button>
      </span>
    </div>
    <div class="stories" style="position:absolute;top:58px;left:0;right:0;z-index:4">${[me.id, ...byAuthor.keys()].filter((id, i, arr) => arr.indexOf(id) === i).map(id => {
      const u = api.user(id);
      return `<button class="story" data-story="${id}"><div class="ring ${byAuthor.has(id) ? "" : "seen"}"><img src="${u.avatar}" alt="" /></div>${esc(u.username)}</button>`;
    }).join("")}</div>
  </section>`);
  $("#bell").onclick = () => { tab = "notes"; render(); };
  $("#findposts").onclick = () => { tab = "search"; render(); };
  app.querySelectorAll("[data-story]").forEach(b => b.onclick = () => openStory(b.dataset.story));
  $("#golive").onclick = () => openLive({ shell, toast, app, $: (q) => $(q), render });
  app.querySelectorAll("[data-feed]").forEach(b => b.onclick = () => { feedMode = b.dataset.feed; render(); });
  bindPosts();
  if (activePost) {
    const active = [...$("#feed").children].find(el => el.dataset.id === activePost);
    if (active) $("#feed").scrollTop = active.offsetTop;
  }
}
function observeVideos() {
  const vids = [...app.querySelectorAll(".clip video")];
  feedObserver = new IntersectionObserver((ents) => ents.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) { v.muted = muted; v.play().catch(() => {}); if (!watchedPosts.has(v.dataset.id)) { watchedPosts.add(v.dataset.id); watch(v.dataset.id); } }
    else v.pause();
  }), { threshold: 0.65 });
  vids.forEach(v => {
    feedObserver.observe(v);
    v.ontimeupdate = () => { const p = api.db().posts.find(p => p.id === v.dataset.id); if (p?.trim && v.currentTime >= p.trim) v.currentTime = 0; };
  });
}
function postCard(p) {
  const u = api.user(p.author);
  const me = api.me();
  const liked = p.likes.includes(me.id);
  const saved = p.saves.includes(me.id);
  const following = me.following.includes(u.id) || u.id === me.id;
  const media = p.kind === "video"
    ? `<video src="${p.media[0]}" data-id="${p.id}" loop playsinline preload="metadata" ${muted ? "muted" : ""}></video>`
    : p.kind === "text"
      ? `<div class="textpost" style="height:100%;background:${p.color}"><p>${esc(p.caption)}</p></div>`
      : `<img class="fullimg" src="${p.media[carouselIndex[p.id] || 0]}" alt="" data-dbl="${p.id}" />`;
  return `<article class="clip" data-id="${p.id}">${media}<div class="shade"></div>
    <div class="rail">
      <button class="act ${liked ? "on" : ""}" data-like="${p.id}" aria-label="Like post" aria-pressed="${liked}">${liked ? ic.heartOn : ic.heart}${fmt(p.likes.length)}</button>
      <button class="act" data-comment="${p.id}" aria-label="Comments">${ic.comment}${fmt(p.comments.length)}</button>
      <button class="act" data-share="${p.id}" aria-label="Share post">${ic.share}</button>
      ${p.kind === "video" ? `<button class="act" data-mute="${p.id}" aria-label="${muted ? "Unmute" : "Mute"} video">${muted ? ic.mute : ic.volume}</button>` : ""}
    </div>
    ${p.kind === "carousel" ? `<div class="carousel-nav">${p.media.map((_, i) => `<button data-dot="${p.id}:${i}" aria-label="Photo ${i + 1} of ${p.media.length}" aria-pressed="${i === (carouselIndex[p.id] || 0)}" class="${i === (carouselIndex[p.id] || 0) ? "on" : ""}"></button>`).join("")}</div>` : ""}
    <div class="meta" style="bottom:158px">
      <div class="handle"><img src="${u.avatar}" alt="" class="avatar" /> <button data-profile="${u.id}">${esc(u.name)}</button>${u.verified ? `<span class="verified" aria-label="Verified">${ic.check}</span>` : ""} ${following ? "" : `<button class="followpill" data-follow="${u.id}">Follow</button>`}</div>
      <div class="cap">${esc(p.caption)}</div>
      ${p.location ? `<div class="sub">${esc(p.location)}</div>` : ""}
    </div>
    <div class="soundbar">
      <img src="${u.avatar}" alt="" />
      <div><b>${esc(p.sound || "Original audio")}</b><div class="sub">▶ ${fmt(p.views || 0)}</div></div>
      <button class="remix ${saved ? "on" : ""}" data-save="${p.id}" aria-label="Save post" aria-pressed="${saved}">${saved ? ic.bookmarkOn : ic.bookmark}</button>
      <button class="remix" data-share="${p.id}">Share</button>
    </div>
  </article>`;
}
function head(u, following, p) {
  return `<div class="handle"><img src="${u.avatar}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /> <button data-profile="${u.id}">@${u.username}</button> ${u.verified ? '<span class="tick">✓</span>' : ""} ${following ? "" : `<button class="followchip" data-follow="${u.id}">Follow</button>`}</div>`;
}
function rail(p, liked, saved) {
  return `<div class="rail">
    <button class="act ${liked ? "on" : ""}" data-like="${p.id}"><span class="bubble">${liked ? ic.heartOn : ic.heart}</span>${fmt(p.likes.length)}</button>
    <button class="act" data-comment="${p.id}"><span class="bubble">${ic.comment}</span>${fmt(p.comments.length)}</button>
    <button class="act" data-share="${p.id}"><span class="bubble">${ic.share}</span>${fmt(p.shares || 0)}</button>
    <button class="act ${saved ? "on" : ""}" data-save="${p.id}"><span class="bubble">${saved ? ic.bookmarkOn : ic.bookmark}</span>${fmt(p.saves.length)}</button>
    <button class="act" data-mute="${p.id}"><span class="bubble">${muted ? ic.mute : ic.volume}</span></button>
    <img class="avatar" src="${api.user(p.author).avatar}" data-profile="${p.author}" alt="" />
  </div>`;
}
function bindPosts() {
  observeVideos();
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
    else { p.likes.push(me.id); (p.tags || []).forEach(t => db.interests[t] = (db.interests[t] || 0) + 1); if (p.author !== me.id) notify(db, { id: "n" + Date.now(), user: p.author, kind: "like", actor: me.id, post: id, body: "liked your post", created: Date.now(), read: false }); }
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
  if (api.blocked(me.id, id)) return toast("Unblock this user before following");
  mutate(db => {
    const meU = db.users.find(x => x.id === me.id);
    const them = db.users.find(x => x.id === id);
    if (meU.following.includes(id)) {
      meU.following = meU.following.filter(x => x !== id);
      them.followers = them.followers.filter(x => x !== me.id);
      db.requests = db.requests.filter(r => !(r.from === me.id && r.to === id));
    } else if (them.private) {
      if (db.requests.some(r => r.from === me.id && r.to === id)) db.requests = db.requests.filter(r => !(r.from === me.id && r.to === id));
      else db.requests.push({ from: me.id, to: id, at: Date.now() });
    } else {
      meU.following.push(id); them.followers.push(me.id);
      notify(db, { id: "n" + Date.now(), user: id, kind: "follow", actor: me.id, body: "started following you", created: Date.now(), read: false });
    }
  });
  render();
  toast(u.private && !api.me().following.includes(id) ? "Requested" : "Updated");
}
function share(id) {
  const link = new URL(location.pathname, location.origin); link.searchParams.set("post", id);
  const copied = copyText(link.href);
  mutate(db => { const p = db.posts.find(x => x.id === id); p.shares = (p.shares || 0) + 1; if (p.author !== api.me().id) notify(db, { id: "n" + Date.now(), user: p.author, kind: "share", actor: api.me().id, post: id, body: "shared your post", created: Date.now(), read: false }); });
  render();
  toast(copied ? "Link copied" : "Share counted");
}
function watch(id) { mutate(db => { const p = db.posts.find(x => x.id === id); if (p) { p.watch = Math.min(1, (p.watch || 0) + 0.08); p.views = (p.views || 0) + 1; } }); }

function comments(id) {
  const sheet = $("#sheet");
  sheet.classList.add("on");
  const draw = () => {
    const p = api.db().posts.find(x => x.id === id);
    sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>Comments</b><div id="clist" style="margin:10px 0;max-height:46vh;overflow:auto"></div>
      <form id="cform" class="row"><input class="field" id="cbody" placeholder="Add a comment" /><button class="icon" id="comment-emoji" type="button" aria-label="Add emoji">${ic.smile}</button><button class="btn small" type="submit">Send</button></form></div>`;
    $("#comment-emoji").onclick = () => openEmojiPicker($("#cbody"));
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
        if (post.author !== api.me().id) notify(db, { id: "n" + Date.now(), user: post.author, kind: parent ? "reply" : "comment", actor: api.me().id, post: id, body: (parent ? "replied: " : "commented: ") + body.slice(0, 80), created: Date.now(), read: false });
      });
      draw();
    };
    sheet.onclick = (e) => { if (e.target === sheet) { sheet.classList.remove("on"); render(); } };
  };
  draw();
}

function openStory(authorId) {
  const list = api.db().stories.filter(s => s.author === authorId && Date.now() - s.created < 864e5 && api.canSeePost(s));
  if (!list.length) { createKind = "story"; openCreate(); return; }
  let i = 0;
  const view = $("#storyview");
  view.classList.add("on");
  const show = () => {
    const s = list[i]; if (!s) { view.classList.remove("on"); clearInterval(storyTimer); return; }
    view.innerHTML = `<div class="progress"><b id="bar"></b></div>
      <div class="row" style="position:absolute;top:24px;left:12px;right:48px;z-index:2"><img src="${api.user(s.author).avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><b>@${api.user(s.author).username}</b></div>
      <button id="sclose" aria-label="Close story" style="position:absolute;top:22px;right:12px;z-index:2">${ic.close}</button>
      <div style="height:100%;background:${s.color || "#000"}">${s.media ? (String(s.media).startsWith("data:video") || s.kind === "video" ? `<video src="${s.media}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="${s.media}" style="width:100%;height:100%;object-fit:cover" />`) : ""}<div style="position:absolute;left:16px;bottom:90px;font-size:28px;font-family:Fraunces,serif">${esc(s.text || "")}</div></div>`;
    $("#sclose").onclick = () => { view.classList.remove("on"); clearInterval(storyTimer); };
    let w = 0; clearInterval(storyTimer);
    storyTimer = setInterval(() => { w += 2; const bar = $("#bar"); if (bar) bar.style.width = w + "%"; if (w >= 100) { i++; show(); } }, 90);
  };
  show();
}

function openCreate() {
  pending = [];
  const sheet = $("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel" style="max-height:94%"><div class="grab"></div><b>Create</b>
    <div class="seg" id="kinds">
      <button data-k="video">Video</button><button data-k="photo">Photo</button><button data-k="carousel">Carousel</button><button data-k="text">Text</button><button data-k="story">Story</button>
    </div>
    <textarea class="field" id="cap" placeholder="Caption, with #tags or @names"></textarea>
    <button class="icon" id="caption-emoji" aria-label="Add emoji to caption">${ic.smile}</button>
    <input class="field" id="loc" placeholder="Location" style="margin-top:8px" value="${esc(api.me().city || "Miami")}" />
    <select class="field" id="vis" style="margin-top:8px"><option value="public">Public</option><option value="followers">Followers</option></select>
    <div class="row" style="margin:8px 0;flex-wrap:wrap"><button class="btn ghost small" id="pick">Upload</button><button class="btn ghost small" id="rec">Record</button><input id="file" type="file" accept="image/*,video/*" multiple hidden /><input id="cam" type="file" accept="video/*,image/*" capture="environment" hidden /><span class="sub" id="picked">No file yet</span></div>
    <video id="prev" controls style="width:100%;max-height:160px;display:none;border-radius:12px"></video>
    <img id="pimg" style="width:100%;max-height:160px;object-fit:cover;display:none;border-radius:12px" />
    <label class="sub">Trim end (seconds, optional) <input class="field" id="trim" type="number" min="1" placeholder="full" /></label>
    <button class="btn" id="post" style="margin-top:10px">Post</button></div>`;
  const paint = () => sheet.querySelectorAll("#kinds button").forEach(b => b.classList.toggle("on", b.dataset.k === createKind));
  paint();
  $("#caption-emoji").onclick = () => openEmojiPicker($("#cap"));
  sheet.querySelector("#kinds").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; createKind = b.dataset.k; paint(); };
  $("#pick").onclick = () => $("#file").click();
  $("#rec").onclick = () => $("#cam").click();
  const take = async (files) => {
    const picked = $("#picked"), prev = $("#prev"), pimg = $("#pimg"), post = $("#post");
    post.disabled = true;
    try {
      pending = [];
      for (const f of files) {
        if (!/^(image|video)\//.test(f.type)) throw new Error("Choose photos or videos");
        pending.push(await fileToData(f));
      }
    } catch (e) { pending = []; toast(e.message || "Couldn't read media"); return; }
    finally { post.disabled = false; }
    if (!picked.isConnected) return;
    picked.textContent = pending.length + " ready";
    prev.style.display = "none"; pimg.style.display = "none";
    if (pending[0]?.video) { prev.style.display = "block"; prev.src = pending[0].url; }
    else if (pending[0]) { pimg.style.display = "block"; pimg.src = pending[0].url; }
  };
  $("#file").onchange = () => take([...$("#file").files]);
  $("#cam").onchange = () => take([...$("#cam").files]);
  $("#post").onclick = async () => {
    const caption = $("#cap").value.trim();
    const tags = [...caption.matchAll(/#([a-z0-9_]+)/gi)].map(m => m[1].toLowerCase());
    if (createKind === "text" && !caption) return toast("Add text");
    if (createKind === "story" && !caption && !pending.length) return toast("Add text or media");
    if (["video", "photo", "carousel"].includes(createKind) && !pending.length) return toast("Add a photo or video");
    if (createKind === "video" && (pending.length !== 1 || !pending[0].video)) return toast("Choose one video");
    if (createKind === "photo" && (pending.length !== 1 || pending[0].video)) return toast("Choose one photo");
    if (createKind === "carousel" && (pending.length < 2 || pending.some(p => p.video))) return toast("Choose at least two photos");
    if (createKind === "story" && pending.length > 1) return toast("Choose one story image or video");
    const trim = Number($("#trim").value) || 0;
    try { mutate(db => {
      if (createKind === "story") db.stories.unshift({ id: "s" + Date.now(), author: api.me().id, kind: pending[0]?.video ? "video" : (pending[0] ? "photo" : "text"), media: pending[0]?.url || "", text: caption, visibility: $("#vis").value, created: Date.now(), color: "#1b140c" });
      else db.posts.unshift({ id: "p" + Date.now(), author: api.me().id, kind: createKind, caption: caption || " ", tags, media: createKind === "text" ? [] : pending.map(p => p.url), sound: "Original audio", location: $("#loc").value || api.me().city, visibility: $("#vis").value, trim, likes: [], comments: [], saves: [], created: Date.now(), views: 0, shares: 0, color: "linear-gradient(160deg,#1b140c,#3a2a18)" });
    }); } catch (e) { toast(e.message); return; }
    pending = []; sheet.classList.remove("on"); tab = "updates"; profileId = null; render(); toast("Posted");
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}

function profile(id) {
  const u = api.user(id);
  const me = api.me();
  if (!u) { profileId = null; return updates(); }
  const locked = !api.canSee(u.id);
  const posts = api.posts().filter(p => p.author === u.id);
  const videos = posts.filter(p => p.kind === "video");
  const saved = api.posts().filter(p => p.saves.includes(me.id));
  const mine = u.id === me.id;
  const grid = locked ? [] : (profileMode === "videos" ? videos : profileMode === "saved" && mine ? saved : posts);
  const requested = api.db().requests.some(r => r.from === me.id && r.to === u.id);
  shell(`<section class="screen on"><div class="scroll profile-page">
    <div class="profile-hero">
      <div class="profile-cover"><img src="${(posts.find(p => p.kind !== "video" && p.media?.[0]) || {}).media?.[0] || u.avatar}" alt="" /></div>
      <div class="profile-topbar"><button id="back" aria-label="Back">←</button><div class="row">${mine ? `<button id="settings-open" class="icon" aria-label="Settings">${ic.settings}</button>` : ""}<button id="sharep" class="icon" aria-label="Share profile">${ic.share}</button></div></div>
      <div class="profile-intro">
        <div class="profile-identity">
          <img class="profile-avatar" src="${u.avatar}" alt="" />
          <div><b class="profile-name">${esc(u.name)}</b><div class="sub">@${u.username}</div></div>
        </div>
        <div class="profile-stats">${fmt(posts.reduce((n,p)=>n+(p.views||0),0))} plays · ${fmt(u.followers.length)} followers · ${fmt(u.following.length)} following</div>
        <p class="cap">${esc(u.bio || "")}</p><p class="sub">${esc(u.city || "")}</p>
        <div class="row profile-primary-actions">${mine ? `<button class="followwide" id="edit">Edit</button><button class="followwide" id="logout">Log out</button>` : `<button class="followwide" id="pfollow">${me.following.includes(u.id) ? "Following" : requested ? "Requested" : "+ Follow"}</button>`}<button class="playround" id="playall">▶</button></div>
        ${!mine ? `<div class="row profile-actions"><button class="btn ghost small" id="pmsg" ${api.blocked(me.id, u.id) ? "disabled" : ""}>Message</button><button class="btn ghost small" id="pblock">${api.db().blocks.some(b => b.by === me.id && b.who === u.id) ? "Unblock" : "Block"}</button><button class="btn ghost small" id="prep">Report</button></div>` : ""}
      </div>
    </div>
    <div class="profile-body">
    <div class="seg">${["posts", "videos", ...(mine ? ["saved"] : [])].map(mode => `<button data-m="${mode}" class="${profileMode === mode ? "on" : ""}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join("")}</div>
    ${locked ? `<div class="empty">This account is private.</div>` : `<div class="row" style="justify-content:space-between"><b>Posts</b><button class="sub" id="more">More</button></div>
      <div class="hooks">${grid.slice(0, profileMore ? grid.length : 8).map(p => `<button class="hookcard" data-open="${p.id}">${p.media?.[0] ? `<img src="${p.kind === "video" ? u.avatar : p.media[0]}" style="width:100%;height:100%;object-fit:cover" />` : `<div style="height:100%;background:${p.color}"></div>`}<span>${esc((p.caption || "post").slice(0, 28))}<br>▶ ${fmt(p.views || 0)}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:space-between;margin-top:14px"><b>Recent</b></div>
      ${grid.slice(0, 5).map(p => `<button class="listbtn" data-open="${p.id}"><img src="${api.user(p.author).avatar}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" /><div><b>${esc(p.caption.slice(0, 32))}</b><div class="sub">${p.kind} · ${fmt(p.likes.length)} likes</div></div></button>`).join("") || `<div class="empty">No ${profileMode} yet.</div>`}`}
    </div>
  </div></section>`);
  $("#back").onclick = () => { profileId = null; render(); };
  $("#settings-open") && ($("#settings-open").onclick = () => { profileId = null; tab = "settings"; render(); });
  $("#sharep") && ($("#sharep").onclick = () => { const link = new URL(location.pathname, location.origin); link.searchParams.set("user", u.username); toast(copyText(link.href) ? "Profile link copied" : "Couldn't copy the link"); });
  $("#playall") && ($("#playall").onclick = () => { const first = grid[0]; if (first) { viewer = first.id; render(); } else toast("No posts to play"); });
  $("#more") && ($("#more").onclick = () => { profileMore = !profileMore; render(); });
  $("#logout") && ($("#logout").onclick = () => { api.logout(); tab = "updates"; chatId = null; profileId = null; viewer = null; render(); });
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
    <button class="icon" id="bio-emoji" aria-label="Add emoji to bio">${ic.smile}</button>
    <label class="sub">Profile photo <input class="field" id="avatar-file" type="file" accept="image/*" /></label>
    <label class="sub">Birthday <input class="field" id="birthday" type="date" value="${esc(me.birthday || "")}" /></label>
    <input class="field" id="city" value="${esc(me.city || "")}" placeholder="City" style="margin-top:8px" />
    <button class="btn" id="savep" style="margin-top:10px">Save</button></div>`;
  $("#bio-emoji").onclick = () => openEmojiPicker($("#bio"));
  $("#savep").onclick = async () => {
    const username = $("#un").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("Bad username");
    if (api.db().users.some(u => u.username === username && u.id !== me.id)) return toast("Username taken");
    const email = $("#em").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter a real email");
    if (api.db().users.some(u => u.email.toLowerCase() === email && u.id !== me.id)) return toast("Email already registered");
    const file = $("#avatar-file").files[0];
    const changes = { name: $("#nm").value.trim() || username, username, email, bio: $("#bio").value.trim(), city: $("#city").value.trim(), birthday: $("#birthday").value };
    try {
      if (file && !file.type.startsWith("image/")) return toast("Choose an image");
      const avatar = file ? (await fileToData(file)).url : me.avatar;
      mutate(db => { const u = db.users.find(x => x.id === me.id); Object.assign(u, { ...changes, avatar }); });
    } catch (e) { toast(e.message); return; }
    sheet.classList.remove("on"); render();
  };
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
function postViewer(id) {
  const p = api.db().posts.find(x => x.id === id);
  if (!api.canSeePost(p)) { viewer = null; render(); toast("Post unavailable"); return; }
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

function search() {
  const q = searchQ.toLowerCase().replace("#", "");
  const users = api.db().users.filter(u => u.id !== api.me().id && !api.blocked(api.me().id, u.id) && (!q || u.username.includes(q) || u.name.toLowerCase().includes(q)));
  const posts = api.posts().filter(p => !q || p.caption.toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)) || (p.location || "").toLowerCase().includes(q));
  const tags = [...new Set(api.posts().flatMap(p => p.tags || []))].filter(t => !q || t.includes(q)).slice(0, 8);
  shell(`<section class="screen on"><div class="scroll page"><button class="sub" id="back">← Updates</button><div class="h1">Search</div>
    <input class="search" id="q" placeholder="People, posts, #tags, places" value="${esc(searchQ)}" />
    <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tags.map(t => `<button class="chip" data-tag="${t}">#${t}</button>`).join("")}</div>
    ${users.slice(0, 8).map(u => `<button class="listbtn" data-profile="${u.id}"><img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" /><div><b>@${u.username}</b><div class="sub">${esc(u.bio || u.city || "")}</div></div></button>`).join("")}
    <div class="grid3" style="margin-top:10px">${posts.slice(0, 12).map(p => `<button class="cell" data-open="${p.id}">${p.media?.[0] ? (p.kind === "video" ? `<video src="${p.media[0]}" muted></video>` : `<img src="${p.media[0]}" />`) : `<div class="textpost" style="height:100%"><p style="font-size:12px">${esc(p.caption.slice(0, 30))}</p></div>`}</button>`).join("")}</div>
    ${!users.length && !posts.length ? `<div class="empty">No results. Try a name, hashtag, or place.</div>` : ""}
  </div></section>`);
  $("#back").onclick = () => { tab = "updates"; render(); };
  $("#q").oninput = (e) => { const position = e.target.selectionStart; searchQ = e.target.value; render(); $("#q").focus(); $("#q").setSelectionRange(position, position); };
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
  shell(`<section class="screen on"><div class="scroll page"><button id="settings-back" class="icon" aria-label="Back to profile">${ic.back}</button><div class="h1">Settings</div>
    <button class="listbtn" id="edit">Account · @${me.username}</button>
    <button class="listbtn" id="pass">Password</button>
    <button class="listbtn" id="priv">Privacy · ${me.private ? "Private" : "Public"} account</button>
    <button class="listbtn" id="blocked">Blocked · ${blocked.length}</button>
    <button class="listbtn" id="notifs">Notifications · ${me.notifs === false ? "off" : "on"}</button>
    <button class="listbtn" id="help">Help · report a problem</button>
    <button class="listbtn" id="about">About · local demo and privacy</button>
    <button class="listbtn" id="reset">Reset sample data</button>
    <button class="btn ghost" id="out" style="margin-top:16px">Log out</button>
    <div id="extra"></div>
  </div></section>`);
  $("#settings-back").onclick = () => { tab = "updates"; profileId = me.id; render(); };
  $("#out").onclick = () => { api.logout(); tab = "updates"; chatId = null; profileId = null; viewer = null; render(); };
  $("#edit").onclick = editProfile;
  $("#priv").onclick = () => { mutate(() => { api.me().private = !api.me().private; }); render(); };
  $("#pass").onclick = () => { $("#extra").innerHTML = `<input class="field" id="cp" type="password" autocomplete="current-password" placeholder="Current password" /><input class="field" id="np" type="password" autocomplete="new-password" placeholder="New password" /><button class="btn" id="sp" style="margin-top:8px">Save password</button>`; $("#sp").onclick = () => { if ($("#cp").value !== api.me().password) return toast("Current password is wrong"); if ($("#np").value.length < 6) return toast("6+ characters"); mutate(() => { api.me().password = $("#np").value; }); toast("Password updated"); }; };
  $("#blocked").onclick = () => { $("#extra").innerHTML = blocked.map(b => `<div class="listbtn"><span>@${api.user(b.who)?.username}</span><button data-un="${b.who}">Unblock</button></div>`).join("") || `<div class="sub">No blocked users.</div>`; $("#extra").querySelectorAll("[data-un]").forEach(b => b.onclick = () => { mutate(db => { db.blocks = db.blocks.filter(x => !(x.by === me.id && x.who === b.dataset.un)); }); render(); }); };
  $("#notifs").onclick = () => { mutate(db => { const u = db.users.find(x => x.id === me.id); u.notifs = u.notifs === false; }); render(); };
  $("#help").onclick = () => {
    $("#extra").innerHTML = `<textarea class="field" id="problem" placeholder="Describe the problem"></textarea><button class="btn" id="save-report">Save local report</button><p class="sub">Reports remain on this device; no support service is connected.</p>`;
    $("#save-report").onclick = () => { const reason = $("#problem").value.trim(); if (!reason) return toast("Describe the problem first"); mutate(db => db.reports.push({ id: "h" + Date.now(), by: me.id, target: "app", reason, at: Date.now() })); toast("Report saved on this device"); };
  };
  $("#about").onclick = () => { $("#extra").innerHTML = `<p class="sub" style="margin-top:8px">Old Time is a social feed and chat. Posts you make stay on this device until a server is connected. Be decent.</p>`; };
  $("#reset").onclick = () => { if (!confirm("Delete all local posts, messages, and accounts and restore sample data?")) return; sessionStorage.removeItem("oldtime-as"); api.reset(); api.login("you@oldtime.app", "oldtime"); render(); };
}

const params = new URLSearchParams(location.search);
if (params.get("as")) sessionStorage.setItem("oldtime-as", params.get("as"));
if (params.get("post")) viewer = params.get("post");
if (params.get("user")) profileId = api.user(params.get("user"))?.id || null;
window.addEventListener("oldtime-data", () => {
  if ($("#sheet.on") || $("#storyview.on") || $(".emoji-overlay") || $("#ftback")) return;
  const input = document.activeElement;
  const position = input?.selectionStart;
  const end = input?.selectionEnd;
  render();
  if (input?.id && $( `#${input.id}`) && typeof position === "number") {
    const next = $(`#${input.id}`); next.focus(); next.setSelectionRange(position, end);
  }
});
window.addEventListener("error", e => { if (e.error?.message) toast(e.error.message); });
window.addEventListener("unhandledrejection", e => { if (e.reason?.message) toast(e.reason.message); });
render();
