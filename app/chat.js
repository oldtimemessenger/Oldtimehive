import { api, mutate } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = "") => String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
const ago = (t) => { const s = Math.max(1, (Date.now() - (t || Date.now())) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };
const clock = (t) => new Date(t || Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (t) => new Date(t).toDateString() === new Date().toDateString() ? "Today" : new Date(t).toLocaleDateString();

export const chatState = { id: null, screen: "list", reply: null, select: [], q: "", call: null };

const REACTS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "👎"];
const GIFS = ["😂", "🔥", "❤️", "🎉", "😭", "👍"];
const STICKERS = ["😎", "🤠", "🥳", "😴", "🤝", "💯"];

function toast(msg) {
  const t = $(".toast"); if (!t) return;
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = "none", 1400);
}

function ensure() {
  mutate(db => {
    db.settings = db.settings || { readReceipts: true, lastSeen: "everyone", appLock: false };
    db.saved = db.saved || [];
    db.devices = db.devices || [{ id: "web", name: "Chrome", kind: "web" }];
    db.convos.forEach(c => {
      c.draft = c.draft || "";
      c.pinnedIds = c.pinnedIds || [];
      c.disappear = c.disappear || "off";
      c.mutedUntil = c.mutedUntil || 0;
      c.wallpaper = c.wallpaper || "";
      c.locked = !!c.locked;
      c.typing = c.typing || null;
      if (c.members.length > 2 && !c.group) c.group = { name: c.title || "Group", description: "", admins: [c.members[0]], permissions: { send: "everyone", info: "admins", add: "admins", pin: "admins", calls: "everyone", polls: "everyone", all: "admins" }, invite: "join-" + c.id, approval: false, requests: [], tags: {} };
      c.messages.forEach(m => {
        m.kind = m.kind || "text";
        m.status = m.status || (m.read ? "read" : "delivered");
        m.reactions = m.reactions || {};
        m.editHistory = m.editHistory || [];
        if (m.starred) db.saved.includes(m.id) || db.saved.push(m.id);
      });
    });
  });
}

function me() { return api.me(); }
function convo(id) { return api.db().convos.find(c => c.id === id); }
function user(id) { return api.user(id); }
function titleOf(c) {
  if (c.group) return c.group.name;
  const other = c.members.filter(id => id !== me().id).map(user).filter(Boolean);
  return c.title || other.map(u => u.name).join(", ") || "Chat";
}
function avatarOf(c) {
  if (c.group) return "";
  return user(c.members.find(id => id !== me().id))?.avatar || "";
}
function tick(m) {
  if (m.author !== me().id) return "";
  if (m.status === "failed") return "⚠️";
  if (m.status === "sending") return "⏳";
  if (m.status === "read") return "✓✓";
  if (m.status === "delivered") return "✓✓";
  return "✓";
}
function presence(c) {
  if (c.typing) return c.typing;
  const other = user(c.members.find(id => id !== me().id));
  if (!other) return c.group ? c.members.length + " people" : "";
  return other.online ? "online" : "last seen " + ago(other.lastSeen || Date.now() - 3600e3);
}

function pushMsg(c, msg) {
  mutate(db => {
    const cv = db.convos.find(x => x.id === c.id);
    msg.id = msg.id || "m" + Date.now();
    msg.created = msg.created || Date.now();
    msg.author = msg.author || me().id;
    msg.status = "sending";
    msg.reactions = msg.reactions || {};
    msg.editHistory = [];
    cv.messages.push(msg);
    cv.draft = "";
  });
  setTimeout(() => mutate(db => {
    const m = db.convos.find(x => x.id === c.id)?.messages.find(x => x.id === msg.id);
    if (m && m.status === "sending") m.status = api.db().settings.readReceipts ? "read" : "delivered";
  }), 500);
}

export function renderChat(ctx) {
  ensure();
  ctx.shell(screen(), true);
  bind(ctx);
}

function screen() {
  if (chatState.call) return callScreen();
  if (!chatState.id || chatState.screen === "list") return listScreen();
  if (chatState.screen === "info") return infoScreen();
  if (chatState.screen === "search") return searchScreen();
  if (chatState.screen === "media") return mediaScreen();
  if (chatState.screen === "saved") return savedScreen();
  if (chatState.screen === "group") return groupScreen();
  return threadScreen();
}

function listScreen() {
  const rows = api.db().convos.filter(c => c.members.includes(me().id) && !c.locked);
  const locked = api.db().convos.filter(c => c.members.includes(me().id) && c.locked).length;
  return `<section class="screen on wa"><div class="scroll" style="padding:10px 14px 96px">
    <div class="topbar" style="padding:6px 0"><b style="font-size:22px">Chats</b>
      <span class="row">
        <button type="button" class="icon" id="saved" style="background:#f2f2f4;color:#111" aria-label="Saved">☆</button>
        <button type="button" class="icon" id="newc" style="background:#f2f2f4;color:#111" aria-label="New chat">＋</button>
      </span>
    </div>
    <input class="search chatsearch" id="cq" placeholder="Search" value="${esc(chatState.q)}" />
    ${locked ? `<button type="button" class="listbtn" id="locked">Locked chats · ${locked}</button>` : ""}
    <div id="crows">${rows.map(c => row(c)).join("") || `<div class="empty">No chats yet.</div>`}</div>
  </div></section>`;
}
function row(c) {
  const q = chatState.q.toLowerCase();
  const name = titleOf(c);
  const last = c.messages[c.messages.length - 1];
  const preview = c.draft ? "Draft: " + c.draft : (last ? previewText(last) : "Say hi");
  if (q && !name.toLowerCase().includes(q) && !preview.toLowerCase().includes(q)) return "";
  const unread = c.messages.filter(m => m.author !== me().id && m.status !== "read").length;
  const av = avatarOf(c);
  return `<button type="button" class="chatrow" data-chat="${c.id}">
    ${av ? `<img src="${av}" alt="" />` : `<span class="gdot">${esc(name.slice(0, 1))}</span>`}
    <span><b>${esc(name)}</b><div class="sub">${esc(preview)}</div></span>
    <span style="text-align:right"><div class="sub">${last ? clock(last.created) : ""}</div>${unread ? `<div class="unread">${unread}</div>` : ""}${c.mutedUntil > Date.now() ? `<div class="sub">Muted</div>` : ""}</span>
  </button>`;
}
function previewText(m) {
  if (m.kind === "photo") return "Photo";
  if (m.kind === "video") return "Video";
  if (m.kind === "voice") return "Voice message";
  if (m.kind === "file") return m.fileName || "Document";
  if (m.kind === "poll") return "Poll";
  if (m.kind === "location") return "Location";
  if (m.kind === "contact") return "Contact";
  if (m.kind === "call") return m.body || "Call";
  if (m.kind === "gif") return "GIF";
  if (m.kind === "sticker") return "Sticker";
  return m.body || "";
}

function threadScreen() {
  const c = convo(chatState.id);
  if (!c) { chatState.id = null; return listScreen(); }
  const other = user(c.members.find(id => id !== me().id));
  mutate(db => db.convos.find(x => x.id === c.id).messages.forEach(m => { if (m.author !== me().id && m.status !== "read" && db.settings.readReceipts) m.status = "read"; }));
  const pin = c.messages.find(m => c.pinnedIds.includes(m.id));
  return `<section class="screen on wa" style="${c.wallpaper ? "background:" + c.wallpaper : ""}">
    <header class="wahead">
      <button type="button" id="back">‹</button>
      <button type="button" class="row" id="info" style="flex:1;text-align:left">
        ${avatarOf(c) ? `<img class="avatar" src="${avatarOf(c)}" alt="" />` : `<span class="gdot">${esc(titleOf(c).slice(0,1))}</span>`}
        <span><b>${esc(titleOf(c))}</b><div class="sub">${esc(c.group ? c.members.length + " participants" : (other ? "@" + other.username + " · " + presence(c) : presence(c)))}</div></span>
      </button>
      <button type="button" id="vcall" aria-label="Voice call">☎</button>
      <button type="button" id="vidcall" aria-label="Video call">▣</button>
      <button type="button" id="find" aria-label="Search">⌕</button>
      <button type="button" id="more" aria-label="More">•••</button>
    </header>
    ${pin ? `<button type="button" class="pinbar" id="pinjump">Pinned · ${esc(previewText(pin))}</button>` : ""}
    <div class="scroll" id="msgs" style="padding:8px 12px 150px">${renderMessages(c)}</div>
    ${chatState.reply ? `<div class="replybar">Replying to ${esc(previewText(c.messages.find(m => m.id === chatState.reply) || {}))}<button type="button" id="clearrep">✕</button></div>` : ""}
    <form class="composer" id="send">
      <button type="button" id="emoji" aria-label="Emoji">☺</button>
      <button type="button" id="attach" aria-label="Attach">＋</button>
      <input id="body" placeholder="Message" value="${esc(c.draft || "")}" />
      <button type="button" id="mic" aria-label="Voice">●</button>
      <button type="submit" id="go">Send</button>
    </form>
  </section>`;
}

function renderMessages(c) {
  let lastDay = "";
  let unreadShown = false;
  return c.messages.map(m => {
    const parts = [];
    const d = day(m.created);
    if (d !== lastDay) { lastDay = d; parts.push(`<div class="datesep">${d}</div>`); }
    if (!unreadShown && m.author !== me().id && m.status !== "read") { unreadShown = true; parts.push(`<div class="datesep">Unread</div>`); }
    parts.push(bubble(m, c));
    return parts.join("");
  }).join("") || `<div class="empty">No messages yet.</div>`;
}

function bubble(m, c) {
  if (m.kind === "system") return `<div class="datesep">${esc(m.body)}</div>`;
  const mine = m.author === me().id;
  const name = user(m.author)?.name || "";
  const reply = m.replyTo ? c.messages.find(x => x.id === m.replyTo) : null;
  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length).map(([e, ids]) => `${e} ${ids.length}`).join("  ");
  const flags = [m.edited ? "edited" : "", m.forwarded ? "Forwarded" : "", m.starred ? "★" : "", c.pinnedIds.includes(m.id) ? "Pinned" : ""].filter(Boolean).join(" · ");
  return `<button type="button" class="bubble-msg ${mine ? "mine" : "theirs"}" data-msg="${m.id}">
    ${c.group && !mine ? `<div class="sub">${esc(name)}${c.group.tags?.[m.author] ? " · " + esc(c.group.tags[m.author]) : ""}</div>` : ""}
    ${reply ? `<div class="quote" data-jump="${reply.id}">${esc(previewText(reply))}</div>` : ""}
    ${bodyOf(m)}
    <div class="meta-line"><span>${flags}</span><span>${clock(m.created)} ${mine ? tick(m) : ""}</span></div>
    ${reacts ? `<div class="reacts">${esc(reacts)}</div>` : ""}
    ${m.status === "failed" ? `<div class="sub" data-retry="${m.id}">Not sent · Retry</div>` : ""}
  </button>`;
}
function bodyOf(m) {
  if (m.expired) return `<div>This photo has expired.</div>`;
  if (m.kind === "photo") return `<div class="mediabox">${m.viewOnce ? "View once" : "Photo"}</div>${m.caption ? `<div>${esc(m.caption)}</div>` : ""}`;
  if (m.kind === "video") return `<div class="mediabox">Video${m.caption ? " · " + esc(m.caption) : ""}</div>`;
  if (m.kind === "voice") return `<div>Voice ${m.duration || "0:04"} · ${m.speed || "1×"}</div>`;
  if (m.kind === "file") return `<div>${esc(m.fileName || "File")} · ${esc(m.fileSize || "120 KB")}</div>`;
  if (m.kind === "gif" || m.kind === "sticker") return `<div style="font-size:42px">${esc(m.body)}</div>`;
  if (m.kind === "location") return `<div>Location · ${esc(m.body || "Shared place")}</div>`;
  if (m.kind === "contact") return `<div>Contact · ${esc(m.body)}</div>`;
  if (m.kind === "call") return `<div>${esc(m.body)}</div>`;
  if (m.kind === "poll") return pollView(m);
  return `<div>${formatText(m.body || "")}</div>`;
}
function formatText(s) {
  return esc(s).replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>").replace(/~([^~]+)~/g, "<s>$1</s>").replace(/`([^`]+)`/g, "<code>$1</code>");
}
function pollView(m) {
  const p = m.poll || { question: m.body, options: [], votes: {} };
  const total = Object.values(p.votes || {}).reduce((n, arr) => n + arr.length, 0) || 0;
  return `<div><b>${esc(p.question)}</b>${(p.options || []).map((o, i) => {
    const n = (p.votes?.[i] || []).length;
    return `<div class="pollopt" data-vote="${m.id}:${i}">${esc(o)} · ${n}${total ? " (" + Math.round(n / total * 100) + "%)" : ""}</div>`;
  }).join("")}${p.closes ? `<div class="sub">Closes ${day(p.closes)}</div>` : ""}</div>`;
}

function infoScreen() {
  const c = convo(chatState.id);
  const other = user(c.members.find(id => id !== me().id));
  return `<section class="screen on wa"><div class="scroll page">
    <div class="topbar"><button type="button" id="back">‹</button><b>Chat info</b><span></span></div>
    <div class="centerprof"><div class="gdot big">${esc(titleOf(c).slice(0,1))}</div><b>${esc(titleOf(c))}</b><div class="sub">${other ? "@" + esc(other.username) : c.members.length + " people"}</div></div>
    <button type="button" class="listbtn" id="media">Shared media</button>
    <button type="button" class="listbtn" id="search">Search</button>
    <button type="button" class="listbtn" id="star">Saved in this chat</button>
    <button type="button" class="listbtn" id="mute">Mute</button>
    <button type="button" class="listbtn" id="disappear">Disappearing messages · ${esc(c.disappear)}</button>
    <button type="button" class="listbtn" id="wall">Wallpaper</button>
    <button type="button" class="listbtn" id="lock">Lock chat</button>
    ${c.group ? `<button type="button" class="listbtn" id="group">Group settings</button>` : `<button type="button" class="listbtn" id="block">Block</button>`}
    <button type="button" class="listbtn" id="report">Report</button>
  </div></section>`;
}
function searchScreen() {
  const c = convo(chatState.id);
  const q = (chatState.q || "").toLowerCase();
  const hits = c.messages.filter(m => !q || previewText(m).toLowerCase().includes(q) || (m.body || "").toLowerCase().includes(q));
  return `<section class="screen on wa"><div class="scroll page">
    <div class="topbar"><button type="button" id="back">‹</button><b>Search</b><span></span></div>
    <input class="search" id="sq" placeholder="Search this chat" value="${esc(chatState.q)}" />
    <div class="seg" id="filters"><button type="button" data-f="all">All</button><button type="button" data-f="photo">Photos</button><button type="button" data-f="video">Videos</button><button type="button" data-f="file">Files</button><button type="button" data-f="voice">Voice</button><button type="button" data-f="poll">Polls</button></div>
    ${hits.map(m => `<button type="button" class="listbtn" data-jump="${m.id}">${esc(previewText(m))}<span class="sub">${clock(m.created)}</span></button>`).join("")}
  </div></section>`;
}
function mediaScreen() {
  const c = convo(chatState.id);
  const media = c.messages.filter(m => ["photo", "video", "file", "voice", "gif"].includes(m.kind));
  return `<section class="screen on wa"><div class="scroll page">
    <div class="topbar"><button type="button" id="back">‹</button><b>Media</b><span></span></div>
    <div class="sub">Photos — ${media.filter(m => m.kind === "photo").length} · Videos — ${media.filter(m => m.kind === "video").length} · Files — ${media.filter(m => m.kind === "file").length} · Voice — ${media.filter(m => m.kind === "voice").length}</div>
    ${media.map(m => `<button type="button" class="listbtn" data-delm="${m.id}">${esc(previewText(m))}<span class="sub">Delete file</span></button>`).join("") || `<div class="empty">No media yet.</div>`}
  </div></section>`;
}
function savedScreen() {
  const ids = api.db().saved || [];
  const items = [];
  api.db().convos.forEach(c => c.messages.forEach(m => { if (m.starred || ids.includes(m.id)) items.push({ c, m }); }));
  return `<section class="screen on wa"><div class="scroll page">
    <div class="topbar"><button type="button" id="back">‹</button><b>Saved</b><span></span></div>
    ${items.map(({ c, m }) => `<button type="button" class="listbtn" data-open="${c.id}">${esc(titleOf(c))} · ${esc(previewText(m))}</button>`).join("") || `<div class="empty">No saved messages.</div>`}
  </div></section>`;
}
function groupScreen() {
  const c = convo(chatState.id);
  const g = c.group;
  const admin = g.admins.includes(me().id);
  return `<section class="screen on wa"><div class="scroll page">
    <div class="topbar"><button type="button" id="back">‹</button><b>Group</b><span></span></div>
    <input class="field" id="gname" value="${esc(g.name)}" />
    <input class="field" id="gdesc" value="${esc(g.description || "")}" placeholder="Description" style="margin-top:8px" />
    ${admin ? `<button type="button" class="btn" id="gsave" style="margin-top:8px">Save</button>` : ""}
    <div class="sec"><b>People</b></div>
    ${c.members.map(id => { const u = user(id); return `<div class="listbtn"><span>${esc(u?.name || id)} ${g.admins.includes(id) ? "· Admin" : ""} ${g.tags?.[id] ? "· " + esc(g.tags[id]) : ""}</span>${admin && id !== me().id ? `<button type="button" data-kick="${id}">Remove</button>` : ""}</div>`; }).join("")}
    ${admin ? `<button type="button" class="listbtn" id="addm">Add member</button><button type="button" class="listbtn" id="fromg">New group from these people</button><button type="button" class="listbtn" id="approve">Join approval · ${g.approval ? "On" : "Off"}</button>` : ""}
    ${(g.requests || []).map(id => `<div class="listbtn">${esc(user(id)?.name || id)} <button type="button" data-ok="${id}">Approve</button></div>`).join("")}
    <div class="sub">Invite link · ${esc(g.invite)}</div>
  </div></section>`;
}
function callScreen() {
  const call = chatState.call;
  const c = convo(call.id);
  return `<section class="screen on" style="background:#111;color:#fff">
    <div class="centerprof" style="padding-top:80px"><b>${esc(titleOf(c))}</b><div class="sub">${call.video ? "Video call" : "Voice call"} · ${call.state}</div>
    <div class="sub" id="ctimer">00:00</div></div>
    <div class="row" style="justify-content:center;gap:12px;margin-top:24px">
      <button type="button" class="playround" id="cmute">${call.muted ? "Unmute" : "Mute"}</button>
      <button type="button" class="playround" id="cend">End</button>
      ${call.video ? `<button type="button" class="playround" id="ccam">Camera</button><button type="button" class="playround" id="cshare">Share</button>` : ""}
    </div>
    <div class="row" style="justify-content:center;gap:8px;margin-top:18px">${REACTS.map(e => `<button type="button" data-cr="${e}">${e}</button>`).join("")}</div>
    ${call.waiting ? `<div class="sub" style="text-align:center;margin-top:12px">Waiting room · <button type="button" id="admit">Admit</button></div>` : ""}
  </section>`;
}

function bind(ctx) {
  const back = () => { if (chatState.screen === "thread") { chatState.id = null; chatState.screen = "list"; } else chatState.screen = chatState.id ? "thread" : "list"; ctx.rerender(); };
  if ($("#back")) $("#back").onclick = back;
  if ($("#newc")) $("#newc").onclick = () => newChat(ctx);
  if ($("#saved")) $("#saved").onclick = () => { chatState.screen = "saved"; ctx.rerender(); };
  if ($("#locked")) $("#locked").onclick = () => { const pin = prompt("Passcode"); if (pin) { api.db().convos.filter(c => c.locked).forEach(c => c.locked = false); mutate(db => db.convos.forEach(c => { if (c.locked) c.locked = false; })); toast("Unlocked"); ctx.rerender(); } };
  if ($("#cq")) $("#cq").oninput = (e) => { chatState.q = e.target.value; ctx.rerender(); };
  document.querySelectorAll("[data-chat]").forEach(b => b.onclick = () => { chatState.id = b.dataset.chat; chatState.screen = "thread"; chatState.q = ""; ctx.rerender(); });
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { chatState.id = b.dataset.open; chatState.screen = "thread"; ctx.rerender(); });
  if ($("#info")) $("#info").onclick = () => { chatState.screen = "info"; ctx.rerender(); };
  if ($("#find")) $("#find").onclick = () => { chatState.q = ""; chatState.screen = "search"; ctx.rerender(); };
  if ($("#more")) $("#more").onclick = () => sheetMenu(ctx, ["View info", "Search", "Mute", "Disappearing messages", "Add to group", "Clear chat"], (label) => {
    if (label === "View info") chatState.screen = "info";
    if (label === "Search") chatState.screen = "search";
    if (label === "Mute") mute(chatState.id);
    if (label === "Disappearing messages") disappear(chatState.id);
    if (label === "Add to group") makeGroup(ctx);
    if (label === "Clear chat") mutate(db => { db.convos.find(x => x.id === chatState.id).messages = []; });
    ctx.rerender();
  });
  if ($("#vcall")) $("#vcall").onclick = () => startCall(ctx, false);
  if ($("#vidcall")) $("#vidcall").onclick = () => startCall(ctx, true);
  if ($("#pinjump")) $("#pinjump").onclick = () => jump(convo(chatState.id).pinnedIds[0]);
  document.querySelectorAll("[data-msg]").forEach(b => b.onclick = () => messageMenu(ctx, b.dataset.msg));
  document.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { chatState.screen = "thread"; ctx.rerender(); setTimeout(() => jump(b.dataset.jump), 40); });
  document.querySelectorAll("[data-vote]").forEach(b => b.onclick = (e) => { e.stopPropagation(); const [id, i] = b.dataset.vote.split(":"); vote(id, +i); ctx.rerender(); });
  document.querySelectorAll("[data-retry]").forEach(b => b.onclick = (e) => { e.stopPropagation(); mutate(db => { const m = db.convos.find(x => x.id === chatState.id).messages.find(x => x.id === b.dataset.retry); m.status = "sent"; }); ctx.rerender(); });
  if ($("#clearrep")) $("#clearrep").onclick = () => { chatState.reply = null; ctx.rerender(); };
  if ($("#emoji")) $("#emoji").onclick = () => sheetMenu(ctx, ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🎉", "😭"], (e) => { const input = $("#body"); if (input) input.value += e; });
  if ($("#attach")) $("#attach").onclick = () => attach(ctx);
  if ($("#mic")) $("#mic").onclick = () => voice(ctx);
  if ($("#send")) $("#send").onsubmit = (e) => { e.preventDefault(); sendText(ctx); };
  if ($("#body")) $("#body").oninput = (e) => { mutate(db => { db.convos.find(x => x.id === chatState.id).draft = e.target.value; }); };
  if ($("#media")) $("#media").onclick = () => { chatState.screen = "media"; ctx.rerender(); };
  if ($("#search")) $("#search").onclick = () => { chatState.screen = "search"; ctx.rerender(); };
  if ($("#star")) $("#star").onclick = () => { chatState.screen = "saved"; ctx.rerender(); };
  if ($("#mute")) $("#mute").onclick = () => { mute(chatState.id); ctx.rerender(); };
  if ($("#disappear")) $("#disappear").onclick = () => { disappear(chatState.id); ctx.rerender(); };
  if ($("#wall")) $("#wall").onclick = () => { const c = convo(chatState.id); mutate(db => { db.convos.find(x => x.id === c.id).wallpaper = c.wallpaper ? "" : "#e7f6e9"; }); toast("Wallpaper updated"); ctx.rerender(); };
  if ($("#lock")) $("#lock").onclick = () => { mutate(db => { db.convos.find(x => x.id === chatState.id).locked = true; }); chatState.id = null; chatState.screen = "list"; toast("Chat locked"); ctx.rerender(); };
  if ($("#block")) $("#block").onclick = () => { const id = convo(chatState.id).members.find(x => x !== me().id); mutate(db => db.blocks.push({ by: me().id, who: id })); toast("Blocked"); };
  if ($("#report")) $("#report").onclick = () => { mutate(db => db.reports.push({ id: "r" + Date.now(), by: me().id, target: chatState.id, reason: "chat", at: Date.now() })); toast("Reported"); };
  if ($("#group")) $("#group").onclick = () => { chatState.screen = "group"; ctx.rerender(); };
  if ($("#sq")) $("#sq").oninput = (e) => { chatState.q = e.target.value; ctx.rerender(); };
  document.querySelectorAll("[data-delm]").forEach(b => b.onclick = () => { mutate(db => { const c = db.convos.find(x => x.id === chatState.id); const m = c.messages.find(x => x.id === b.dataset.delm); if (m) { m.body = ""; m.kind = "system"; m.expired = true; } }); ctx.rerender(); });
  if ($("#gsave")) $("#gsave").onclick = () => { mutate(db => { const g = db.convos.find(x => x.id === chatState.id).group; g.name = $("#gname").value; g.description = $("#gdesc").value; }); toast("Saved"); };
  document.querySelectorAll("[data-kick]").forEach(b => b.onclick = () => { mutate(db => { const c = db.convos.find(x => x.id === chatState.id); c.members = c.members.filter(id => id !== b.dataset.kick); }); ctx.rerender(); });
  if ($("#addm")) $("#addm").onclick = () => addMember(ctx);
  if ($("#fromg")) $("#fromg").onclick = () => makeGroup(ctx, true);
  if ($("#approve")) $("#approve").onclick = () => { mutate(db => { db.convos.find(x => x.id === chatState.id).group.approval = !db.convos.find(x => x.id === chatState.id).group.approval; }); ctx.rerender(); };
  document.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => { mutate(db => { const g = db.convos.find(x => x.id === chatState.id); g.members.push(b.dataset.ok); g.group.requests = g.group.requests.filter(id => id !== b.dataset.ok); }); ctx.rerender(); });
  if ($("#cmute")) $("#cmute").onclick = () => { chatState.call.muted = !chatState.call.muted; ctx.rerender(); };
  if ($("#cend")) $("#cend").onclick = () => endCall(ctx);
  if ($("#ccam")) $("#ccam").onclick = () => toast(chatState.call.cam ? "Camera off" : "Camera on");
  if ($("#cshare")) $("#cshare").onclick = () => toast("Sharing screen");
  if ($("#admit")) $("#admit").onclick = () => { chatState.call.waiting = false; toast("Admitted"); ctx.rerender(); };
  document.querySelectorAll("[data-cr]").forEach(b => b.onclick = () => toast(b.dataset.cr));
  const box = $("#msgs"); if (box) box.scrollTop = box.scrollHeight;
}

function jump(id) {
  const el = document.querySelector(`[data-msg="${id}"]`);
  if (el) el.scrollIntoView({ block: "center" });
}
function sendText(ctx) {
  const text = $("#body").value.trim();
  if (!text) return;
  const c = convo(chatState.id);
  pushMsg(c, { kind: "text", body: text, replyTo: chatState.reply, status: "sending" });
  chatState.reply = null;
  ctx.rerender();
}
function messageMenu(ctx, id) {
  const c = convo(chatState.id);
  const m = c.messages.find(x => x.id === id);
  if (!m) return;
  if (m.viewOnce && !m.viewed && m.author !== me().id) {
    mutate(db => { const msg = db.convos.find(x => x.id === c.id).messages.find(x => x.id === id); msg.viewed = true; msg.expired = true; });
    toast("Opened once"); ctx.rerender(); return;
  }
  const mine = m.author === me().id;
  const actions = ["Reply", "React", "Forward", "Copy", "Star", "Pin", "Share", "Delete"];
  if (mine && m.kind === "text") actions.splice(5, 0, "Edit");
  if (mine) actions.push("Delete for everyone");
  sheetMenu(ctx, actions, (label) => {
    if (label === "Reply") chatState.reply = id;
    if (label === "React") sheetMenu(ctx, REACTS, (e) => { react(id, e); ctx.rerender(); });
    if (label === "Forward") forward(ctx, id);
    if (label === "Copy") { navigator.clipboard?.writeText(m.body || previewText(m)); toast("Copied"); }
    if (label === "Star") mutate(db => { const msg = db.convos.find(x => x.id === c.id).messages.find(x => x.id === id); msg.starred = !msg.starred; if (msg.starred) db.saved.push(id); });
    if (label === "Pin") mutate(db => { const cv = db.convos.find(x => x.id === c.id); cv.pinnedIds = cv.pinnedIds.includes(id) ? cv.pinnedIds.filter(x => x !== id) : [id, ...cv.pinnedIds].slice(0, 3); });
    if (label === "Edit") { const next = prompt("Edit message", m.body); if (next) mutate(db => { const msg = db.convos.find(x => x.id === c.id).messages.find(x => x.id === id); msg.editHistory.push(msg.body); msg.body = next; msg.edited = true; }); }
    if (label === "Delete" || label === "Delete for everyone") mutate(db => { const cv = db.convos.find(x => x.id === c.id); cv.messages = cv.messages.filter(x => x.id !== id); });
    if (label === "Share") { navigator.clipboard?.writeText(m.body || previewText(m)); toast("Copied"); }
    ctx.rerender();
  });
}
function react(id, emoji) {
  mutate(db => {
    const m = db.convos.find(x => x.id === chatState.id).messages.find(x => x.id === id);
    m.reactions[emoji] = m.reactions[emoji] || [];
    const i = m.reactions[emoji].indexOf(me().id);
    if (i >= 0) m.reactions[emoji].splice(i, 1); else m.reactions[emoji].push(me().id);
  });
}
function vote(id, i) {
  mutate(db => {
    const m = db.convos.find(x => x.id === chatState.id).messages.find(x => x.id === id);
    m.poll.votes = m.poll.votes || {};
    Object.keys(m.poll.votes).forEach(k => { m.poll.votes[k] = (m.poll.votes[k] || []).filter(u => u !== me().id); });
    m.poll.votes[i] = m.poll.votes[i] || [];
    m.poll.votes[i].push(me().id);
  });
}
function forward(ctx, id) {
  const targets = api.db().convos.filter(c => c.members.includes(me().id) && c.id !== chatState.id);
  sheetMenu(ctx, targets.map(titleOf), (name) => {
    const to = targets.find(c => titleOf(c) === name);
    const src = convo(chatState.id).messages.find(m => m.id === id);
    pushMsg(to, { ...src, id: "m" + Date.now(), forwarded: true, author: me().id, created: Date.now() });
    toast("Forwarded");
  });
}
function attach(ctx) {
  sheetMenu(ctx, ["Camera", "Photo", "Video", "Document", "GIF", "Sticker", "Location", "Contact", "Poll", "View once"], (label) => {
    const c = convo(chatState.id);
    if (label === "Photo" || label === "Camera") pushMsg(c, { kind: "photo", body: "Photo", caption: "" });
    if (label === "Video") pushMsg(c, { kind: "video", body: "Video" });
    if (label === "Document") pushMsg(c, { kind: "file", fileName: "notes.pdf", fileSize: "240 KB", body: "notes.pdf" });
    if (label === "GIF") pushMsg(c, { kind: "gif", body: GIFS[Math.floor(Math.random() * GIFS.length)] });
    if (label === "Sticker") pushMsg(c, { kind: "sticker", body: STICKERS[Math.floor(Math.random() * STICKERS.length)] });
    if (label === "Location") pushMsg(c, { kind: "location", body: me().city || "Current location" });
    if (label === "Contact") pushMsg(c, { kind: "contact", body: me().name + " · @" + me().username });
    if (label === "Poll") pushMsg(c, { kind: "poll", body: "Where should we eat?", poll: { question: "Where should we eat?", options: ["Pizza", "Burgers", "Tacos", "Sushi"], votes: {}, closes: Date.now() + 864e5 } });
    if (label === "View once") pushMsg(c, { kind: "photo", body: "Photo", viewOnce: true });
    ctx.rerender();
  });
}
function voice(ctx) {
  const c = convo(chatState.id);
  pushMsg(c, { kind: "voice", body: "Voice message", duration: "0:03", speed: "1×" });
  toast("Voice message sent");
  ctx.rerender();
}
function mute(id) {
  sheetMenu({ rerender() {} }, ["1 hour", "8 hours", "1 week", "Forever", "Unmute"], (label) => {
    const map = { "1 hour": 3600e3, "8 hours": 8 * 3600e3, "1 week": 7 * 864e5, "Forever": 3650 * 864e5, "Unmute": 0 };
    mutate(db => { db.convos.find(x => x.id === id).mutedUntil = map[label] ? Date.now() + map[label] : 0; });
    toast(label === "Unmute" ? "Unmuted" : "Muted");
  });
}
function disappear(id) {
  sheetMenu({ rerender() {} }, ["Off", "24 hours", "7 days", "90 days"], (label) => {
    mutate(db => { db.convos.find(x => x.id === id).disappear = label === "Off" ? "off" : label; });
    toast("Disappearing messages " + label);
  });
}
function startCall(ctx, video) {
  chatState.call = { id: chatState.id, video, state: "Ringing", muted: false, waiting: !!convo(chatState.id).group, started: Date.now() };
  pushMsg(convo(chatState.id), { kind: "call", body: (video ? "Video call" : "Voice call") + " started" });
  ctx.rerender();
  setTimeout(() => { if (chatState.call) { chatState.call.state = "Connected"; ctx.rerender(); } }, 700);
}
function endCall(ctx) {
  const call = chatState.call;
  const mins = Math.max(1, Math.round((Date.now() - call.started) / 60000));
  pushMsg(convo(call.id), { kind: "call", body: (call.video ? "Video call" : "Voice call") + " · " + mins + " min" });
  chatState.call = null;
  chatState.screen = "thread";
  ctx.rerender();
}
function newChat(ctx) {
  const people = api.db().users.filter(u => u.id !== me().id);
  sheetMenu(ctx, people.map(u => u.name), (name) => {
    const u = people.find(x => x.name === name);
    let c = api.db().convos.find(x => !x.group && x.members.length === 2 && x.members.includes(me().id) && x.members.includes(u.id));
    if (!c) mutate(db => db.convos.push({ id: "cv" + Date.now(), members: [me().id, u.id], messages: [], draft: "", pinnedIds: [], disappear: "off", mutedUntil: 0 }));
    c = api.db().convos.find(x => !x.group && x.members.includes(u.id) && x.members.includes(me().id));
    chatState.id = c.id; chatState.screen = "thread"; ctx.rerender();
  });
}
function addMember(ctx) {
  const c = convo(chatState.id);
  const people = api.db().users.filter(u => !c.members.includes(u.id));
  sheetMenu(ctx, people.map(u => u.name), (name) => {
    const u = people.find(x => x.name === name);
    mutate(db => { const cv = db.convos.find(x => x.id === c.id); if (cv.group.approval) cv.group.requests.push(u.id); else cv.members.push(u.id); });
    ctx.rerender();
  });
}
function makeGroup(ctx, fromExisting) {
  const name = prompt("Group name", "New group");
  if (!name) return;
  const base = fromExisting ? convo(chatState.id).members.slice(0, 8) : [me().id];
  mutate(db => db.convos.push({ id: "cv" + Date.now(), members: base, title: name, messages: [{ id: "sys" + Date.now(), author: "system", kind: "system", body: name + " created", created: Date.now(), status: "read", reactions: {} }], draft: "", pinnedIds: [], disappear: "off", mutedUntil: 0, group: { name, description: "", admins: [me().id], permissions: { send: "everyone", info: "admins", add: "admins", pin: "admins", calls: "everyone", polls: "everyone", all: "admins" }, invite: "join-" + Date.now(), approval: false, requests: [], tags: {} } }));
  const c = api.db().convos[api.db().convos.length - 1];
  chatState.id = c.id; chatState.screen = "thread";
  ctx.rerender();
}
function sheetMenu(ctx, labels, onPick) {
  const sheet = $("#sheet");
  if (!sheet) return;
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div>${labels.map(l => `<button type="button" class="listbtn" data-l="${esc(l)}">${esc(l)}</button>`).join("")}</div>`;
  sheet.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { sheet.classList.remove("on"); onPick(b.dataset.l); });
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
