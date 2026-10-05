import { api, mutate } from "./store.js";
import { placeCall, openVoiceNote, voiceBody, bindVoice } from "./comms/index.js";

const REACTS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "👎"];
let ui = { reply: null, screen: "thread", q: "", call: null, filter: "all" };

export function ensureConvo(ids) {
  const me = api.me();
  const members = [me.id, ...ids.filter(id => id !== me.id)];
  let c = api.db().convos.find(x => x.members.length === members.length && members.every(id => x.members.includes(id)));
  if (!c) {
    c = blankConvo(members);
    mutate(db => db.convos.unshift(c));
  }
  ready(c.id);
  return c.id;
}

function blankConvo(members, title) {
  return { id: "cv" + Date.now(), members, title: title || "", messages: [], draft: "", pinnedIds: [], disappear: "after view", mutedUntil: 0, wallpaper: "", locked: false, group: members.length > 2 ? groupMeta(title || "Group", members[0]) : null };
}
function groupMeta(name, admin) {
  return { name, description: "", admins: [admin], permissions: { send: "everyone", info: "admins", add: "admins", pin: "admins", calls: "everyone", polls: "everyone", all: "admins" }, invite: "join-" + Date.now(), approval: false, requests: [], tags: {}, history: "off" };
}
function ready(id) {
  mutate(db => {
    db.saved = db.saved || [];
    db.settings = db.settings || { readReceipts: true, lastSeen: "everyone" };
    const c = db.convos.find(x => x.id === id);
    if (!c) return;
    c.draft = c.draft || "";
    c.pinnedIds = c.pinnedIds || [];
    c.disappear = c.disappear || "after view";
    db.kept = db.kept || [];
    const now = Date.now();
    c.messages = c.messages.filter(m => !(m.expiresAt && m.expiresAt <= now));
    c.mutedUntil = c.mutedUntil || 0;
    c.wallpaper = c.wallpaper || "";
    if (c.members.length > 2 && !c.group) c.group = groupMeta(c.title || "Group", c.members[0]);
    c.messages.forEach(m => {
      m.kind = m.kind || "text";
      m.status = m.status || (m.read ? "read" : "delivered");
      m.reactions = m.reactions || {};
      m.editHistory = m.editHistory || [];
    });
  });
}
const clock = (t) => new Date(t || Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (t) => new Date(t).toDateString() === new Date().toDateString() ? "Today" : new Date(t).toLocaleDateString();
function convo(id) { return api.db().convos.find(c => c.id === id); }
function nameOf(c, me) {
  if (c.group) return c.group.name || c.title || "Group";
  return c.title || c.members.filter(id => id !== me.id).map(id => api.user(id)?.name).filter(Boolean).join(", ") || "Chat";
}
function preview(m) {
  if (!m) return "New chat";
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
function tick(m, me) {
  if (m.author !== me.id) return "";
  if (m.status === "failed") return " !";
  if (m.status === "sending") return " …";
  if (m.status === "read") return " ✓✓";
  if (m.status === "delivered") return " ✓✓";
  return " ✓";
}
function ttl(mode) {
  if (mode === "10 seconds") return 10e3;
  if (mode === "24 hours") return 864e5;
  if (mode === "after view") return 8e3;
  return 0;
}
export function logCall(id, label) {
  pushMsg(id, { kind: "call", body: label });
}
function pushMsg(id, msg) {
  msg.id = msg.id || "m" + Date.now();
  msg.created = Date.now();
  msg.author = msg.author || api.me().id;
  msg.status = "sending";
  msg.reactions = msg.reactions || {};
  msg.editHistory = msg.editHistory || [];
  msg.kept = false;
  const mode = convo(id)?.disappear || "after view";
  if (mode !== "off" && mode !== "after view") msg.expiresAt = Date.now() + ttl(mode);
  if (msg.kind && msg.kind !== "text") { msg.fileSize = msg.fileSize || ""; msg.body = msg.body || msg.kind; }
  mutate(db => {
    const c = db.convos.find(x => x.id === id);
    c.messages.push(msg);
    c.draft = "";
  });
  setTimeout(() => mutate(db => {
    const m = db.convos.find(x => x.id === id)?.messages.find(x => x.id === msg.id);
    if (m && m.status === "sending") m.status = (db.settings?.readReceipts === false) ? "delivered" : "read";
  }), 400);
}

export function openChatList(ctx) {
  ui.screen = "list";
  const me = api.me();
  const rows = api.db().convos.filter(c => c.members.includes(me.id) && !c.locked && !c.members.some(id => api.db().blocks.some(b => b.by === me.id && b.who === id)));
  const locked = api.db().convos.filter(c => c.members.includes(me.id) && c.locked);
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="row" style="justify-content:space-between"><button class="icon" id="saved">☆</button><div class="row"><img src="${me.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" /><b>Chats</b></div><div class="row"><button class="icon" id="newgroup">＋</button><button class="icon" id="newchat">✎</button></div></div>
    <input class="chatsearch" id="cq" placeholder="Search" />
    ${locked.map(c => `<button class="listbtn" data-unlock="${c.id}">Locked · ${ctxEsc(nameOf(c, me))}</button>`).join("")}
    <div id="crows">${rows.map(c => row(c, me)).join("")}</div>
  </div></section>`, "light");
  ctx.$("#newchat").onclick = () => pick(ctx, false);
  ctx.$("#newgroup").onclick = () => pick(ctx, true);
  ctx.$("#saved").onclick = () => saved(ctx);
  ctx.app.querySelectorAll("[data-unlock]").forEach(b => b.onclick = () => { mutate(db => { db.convos.find(x => x.id === b.dataset.unlock).locked = false; }); ui.screen = "thread"; ctx.setChat(b.dataset.unlock); });
  ctx.$("#cq").oninput = (e) => {
    const q = e.target.value.toLowerCase();
    ctx.$("#crows").innerHTML = rows.filter(c => nameOf(c, me).toLowerCase().includes(q) || (c.draft || "").toLowerCase().includes(q) || preview(c.messages.at(-1)).toLowerCase().includes(q)).map(c => row(c, me)).join("");
    bindRows(ctx);
  };
  bindRows(ctx);
}
function row(c, me) {
  const last = c.messages[c.messages.length - 1];
  const unread = c.messages.filter(m => m.author !== me.id && m.status !== "read" && !m.read).length;
  const text = c.draft ? "Draft: " + c.draft : preview(last);
  const others = c.members.filter(id => id !== me.id).map(api.user).filter(Boolean);
  return `<button class="listbtn" data-cv="${c.id}"><img src="${others[0]?.avatar || me.avatar}" style="width:52px;height:52px;border-radius:50%;object-fit:cover" /><div style="flex:1"><b>${ctxEsc(nameOf(c, me))}</b><div class="sub">${ctxEsc(text).slice(0, 48)}</div></div><div style="text-align:right"><div class="sub">${last ? clock(last.created) : ""}</div>${unread ? `<span class="unread">${unread}</span>` : ""}${c.mutedUntil > Date.now() ? `<div class="sub">Muted</div>` : ""}</div></button>`;
}
function bindRows(ctx) {
  ctx.app.querySelectorAll("[data-cv]").forEach(b => b.onclick = () => { ui.screen = "thread"; ctx.setChat(b.dataset.cv); });
}
function ctxEsc(s) { return String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;"); }

export function openThread(id, ctx) {
  ready(id);
  if (ui.screen === "info") return info(ctx, id);
  if (ui.screen === "search") return search(ctx, id);
  if (ui.screen === "media") return media(ctx, id);
  if (ui.screen === "group") return group(ctx, id);
  const c = convo(id);
  const me = api.me();
  const other = api.user(c.members.find(x => x !== me.id)) || me;
  mutate(db => db.convos.find(x => x.id === id).messages.forEach(m => { if (m.author !== me.id && !m.kept) { m.read = true; if (db.settings.readReceipts !== false) m.status = "read"; if ((db.convos.find(x => x.id === id).disappear === "after view") && !m.expiresAt) m.expiresAt = Date.now() + 8000; } }));
  const pin = c.messages.find(m => (c.pinnedIds || []).includes(m.id));
  const presence = c.group ? c.members.length + " participants" : (other.online ? "online" : "last seen " + ctx.ago(other.lastSeen || Date.now() - 36e5));
  ctx.shell(`<section class="screen on" style="background:${c.wallpaper || "#fff"};color:#111">
    <div class="topbar">
      <button id="back">←</button>
      <img src="${other.avatar}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" />
      <button id="info" style="text-align:left;flex:1"><b>${ctxEsc(c.group ? nameOf(c, me) : other.name)}</b> ${other.verified && !c.group ? "✓" : ""}<div class="sub">${c.group ? presence : "@" + ctxEsc(other.username) + " · " + presence}</div></button>
      <button id="vcall" aria-label="Voice">☎</button>
      <button id="vid" aria-label="Video">▣</button>
      <button id="find">⌕</button>
      <button id="more">•••</button>
    </div>
    ${pin ? `<button class="pinbar" id="pinjump">Pinned · ${ctxEsc(preview(pin))}</button>` : ""}
    <div class="scroll" id="msgs" style="padding:8px 12px 150px">${messages(c, me)}</div>
    ${ui.reply ? `<div class="replybar">Reply · ${ctxEsc(preview(c.messages.find(m => m.id === ui.reply) || {}))}<button id="clearrep">✕</button></div>` : ""}
    <form id="send" class="composer"><button type="button" id="emoji">☺</button><button type="button" id="attach">＋</button><input id="msg" placeholder="Message" value="${ctxEsc(c.draft || "")}" /><button type="button" id="mic">●</button><button type="submit">Send</button></form>
  </section>`, "light");
  ctx.$("#back").onclick = () => { ui.screen = "list"; ui.reply = null; ctx.setChat(null); };
  ctx.$("#info").onclick = () => { ui.screen = "info"; ctx.render(); };
  ctx.$("#find").onclick = () => { ui.screen = "search"; ctx.render(); };
  ctx.$("#more").onclick = () => menu(ctx, ["Chat info", "Search", "Mute", "Disappearing messages", "Wallpaper", "Lock chat"], (label) => {
    if (label === "Chat info") ui.screen = "info";
    if (label === "Search") ui.screen = "search";
    if (label === "Mute") return mute(ctx, id);
    if (label === "Disappearing messages") return disappear(ctx, id);
    if (label === "Wallpaper") mutate(db => { const cv = db.convos.find(x => x.id === id); cv.wallpaper = cv.wallpaper ? "" : "#e7f6e9"; });
    if (label === "Lock chat") { mutate(db => { db.convos.find(x => x.id === id).locked = true; }); ui.screen = "list"; ctx.setChat(null); return; }
    ctx.render();
  });
  ctx.$("#vcall").onclick = () => placeCall(ctx, id, false);
  ctx.$("#vid").onclick = () => placeCall(ctx, id, true);
  if (ctx.$("#pinjump")) ctx.$("#pinjump").onclick = () => jump(c.pinnedIds[0]);
  if (ctx.$("#clearrep")) ctx.$("#clearrep").onclick = () => { ui.reply = null; ctx.render(); };
  ctx.$("#emoji").onclick = () => menu(ctx, ["😀", "😂", "❤️", "🔥", "👍", "🙏"], (e) => { ctx.$("#msg").value += e; });
  ctx.$("#attach").onclick = () => attach(ctx, id);
  ctx.$("#mic").onclick = () => openVoiceNote(ctx, id, pushMsg);
  ctx.$("#msg").oninput = (e) => mutate(db => { db.convos.find(x => x.id === id).draft = e.target.value; });
  ctx.$("#send").onsubmit = (e) => { e.preventDefault(); const body = ctx.$("#msg").value.trim(); if (!body) return; pushMsg(id, { kind: "text", body, replyTo: ui.reply }); ui.reply = null; ctx.render(); };
  ctx.app.querySelectorAll("[data-msg]").forEach(b => b.onclick = () => onMessage(ctx, id, b.dataset.msg));
  bindVoice(ctx.app);
  ctx.app.querySelectorAll("[data-vote]").forEach(b => b.onclick = (e) => { e.stopPropagation(); const [mid, i] = b.dataset.vote.split(":"); vote(id, mid, +i); ctx.render(); });
  ctx.app.querySelectorAll("[data-retry]").forEach(b => b.onclick = (e) => { e.stopPropagation(); mutate(db => { db.convos.find(x => x.id === id).messages.find(x => x.id === b.dataset.retry).status = "sent"; }); ctx.render(); });
  const box = ctx.$("#msgs"); if (box) box.scrollTop = box.scrollHeight;
}
function messages(c, me) {
  let last = "", unread = false;
  return c.messages.map(m => {
    const bits = [];
    const d = day(m.created);
    if (d !== last) { last = d; bits.push(`<div class="datesep">${d}</div>`); }
    if (!unread && m.author !== me.id && m.status !== "read" && !m.read) { unread = true; bits.push(`<div class="datesep">Unread</div>`); }
    bits.push(bubble(m, c, me));
    return bits.join("");
  }).join("") || `<div class="empty">No messages yet.</div>`;
}
function bubble(m, c, me) {
  if (m.kind === "system") return `<div class="datesep">${ctxEsc(m.body || "")}</div>`;
  const mine = m.author === me.id;
  const reply = m.replyTo ? c.messages.find(x => x.id === m.replyTo) : null;
  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length).map(([e, ids]) => e + " " + ids.length).join("  ");
  const flags = [m.edited ? "edited" : "", m.forwarded ? "Forwarded" : "", m.starred ? "★" : "", (c.pinnedIds || []).includes(m.id) ? "Pinned" : ""].filter(Boolean).join(" · ");
  return `<button class="bubble-msg ${mine ? "mine" : "theirs"}" data-msg="${m.id}">
    ${c.group && !mine ? `<div class="sub">${ctxEsc(api.user(m.author)?.name || "")}</div>` : ""}
    ${reply ? `<div class="quote">${ctxEsc(preview(reply))}</div>` : ""}
    ${body(m)}
    <div class="meta-line"><span>${flags}</span><span>${clock(m.created)}${tick(m, me)}</span></div>
    ${reacts ? `<div class="reacts">${reacts}</div>` : ""}
    ${m.status === "failed" ? `<div class="sub" data-retry="${m.id}">Not sent · Retry</div>` : ""}
  </button>`;
}
function body(m) {
  if (m.expired) return "This photo has expired.";
  if (m.kind === "photo") return `Photo${m.viewOnce ? " · View once" : ""}${m.caption ? "<div>" + ctxEsc(m.caption) + "</div>" : ""}`;
  if (m.kind === "video") return "Video";
  if (m.kind === "voice") return voiceBody(m);
  if (m.kind === "file") return ctxEsc(m.fileName || "File") + " · " + ctxEsc(m.fileSize || "120 KB");
  if (m.kind === "gif" || m.kind === "sticker") return `<div style="font-size:36px">${ctxEsc(m.body || "")}</div>`;
  if (m.kind === "location") return "Location · " + ctxEsc(m.body || "Shared place");
  if (m.kind === "contact") return "Contact · " + ctxEsc(m.body || "");
  if (m.kind === "call") return ctxEsc(m.body || "Call");
  if (m.kind === "poll") return poll(m);
  const linked = ctxEsc(m.body || "").replace(/(https?:\/\/[^\s]+)/g, '<span class="sub">$1</span>');
  return linked.replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>").replace(/~([^~]+)~/g, "<s>$1</s>");
}
function poll(m) {
  const p = m.poll || { question: m.body, options: [], votes: {} };
  return `<b>${ctxEsc(p.question)}</b>` + (p.options || []).map((o, i) => `<div class="pollopt" data-vote="${m.id}:${i}">${ctxEsc(o)} · ${(p.votes?.[i] || []).length}</div>`).join("");
}
function onMessage(ctx, cid, id) {
  const c = convo(cid);
  const m = c.messages.find(x => x.id === id);
  if (!m) return;
  if (m.viewOnce && !m.viewed && m.author !== api.me().id) {
    mutate(db => { const msg = db.convos.find(x => x.id === cid).messages.find(x => x.id === id); msg.viewed = true; msg.expired = true; });
    ctx.toast("Opened once"); ctx.render(); return;
  }
  const mine = m.author === api.me().id;
  const actions = ["Reply", "React", "Forward", "Copy", "Keep", "Star", "Pin", "Delete"];
  if (mine && m.kind === "text") actions.splice(5, 0, "Edit");
  if (mine) actions.push("Delete for everyone");
  menu(ctx, actions, (label) => {
    if (label === "Reply") ui.reply = id;
    if (label === "React") return menu(ctx, REACTS, (e) => { react(cid, id, e); ctx.render(); });
    if (label === "Forward") return forward(ctx, cid, id);
    if (label === "Copy") { navigator.clipboard?.writeText(m.body || preview(m)); ctx.toast("Copied"); }
    if (label === "Keep") mutate(db => { const msg = db.convos.find(x => x.id === cid).messages.find(x => x.id === id); msg.kept = true; delete msg.expiresAt; db.kept = db.kept || []; db.kept.push({ id, chat: cid, body: (msg.body || "").slice(0, 280), kind: msg.kind, at: Date.now() }); });
    if (label === "Star") mutate(db => { const msg = db.convos.find(x => x.id === cid).messages.find(x => x.id === id); msg.starred = !msg.starred; db.saved = db.saved || []; if (msg.starred) db.saved.push(id); });
    if (label === "Pin") mutate(db => { const cv = db.convos.find(x => x.id === cid); cv.pinnedIds = cv.pinnedIds.includes(id) ? cv.pinnedIds.filter(x => x !== id) : [id, ...cv.pinnedIds].slice(0, 3); });
    if (label === "Edit") { const next = prompt("Edit message", m.body); if (next) mutate(db => { const msg = db.convos.find(x => x.id === cid).messages.find(x => x.id === id); msg.editHistory.push(msg.body); msg.body = next; msg.edited = true; }); }
    if (label === "Delete" || label === "Delete for everyone") mutate(db => { const cv = db.convos.find(x => x.id === cid); cv.messages = cv.messages.filter(x => x.id !== id); });
    ctx.render();
  });
}
function react(cid, id, emoji) {
  mutate(db => {
    const m = db.convos.find(x => x.id === cid).messages.find(x => x.id === id);
    m.reactions[emoji] = m.reactions[emoji] || [];
    const i = m.reactions[emoji].indexOf(api.me().id);
    if (i >= 0) m.reactions[emoji].splice(i, 1); else m.reactions[emoji].push(api.me().id);
  });
}
function vote(cid, id, i) {
  mutate(db => {
    const m = db.convos.find(x => x.id === cid).messages.find(x => x.id === id);
    m.poll.votes = m.poll.votes || {};
    Object.keys(m.poll.votes).forEach(k => { m.poll.votes[k] = m.poll.votes[k].filter(u => u !== api.me().id); });
    m.poll.votes[i] = m.poll.votes[i] || [];
    m.poll.votes[i].push(api.me().id);
  });
}
function forward(ctx, cid, id) {
  const targets = api.db().convos.filter(c => c.members.includes(api.me().id) && c.id !== cid);
  menu(ctx, targets.map(c => nameOf(c, api.me())), (name) => {
    const to = targets.find(c => nameOf(c, api.me()) === name);
    const src = convo(cid).messages.find(m => m.id === id);
    pushMsg(to.id, { ...src, id: "m" + Date.now(), forwarded: true, author: api.me().id });
    ctx.toast("Forwarded");
  });
}
function attach(ctx, id) {
  menu(ctx, ["Camera", "Photo", "Video", "Document", "GIF", "Sticker", "Location", "Contact", "Poll", "View once"], (label) => {
    const me = api.me();
    if (label === "Photo" || label === "Camera") pushMsg(id, { kind: "photo", body: "Photo" });
    if (label === "Video") pushMsg(id, { kind: "video", body: "Video" });
    if (label === "Document") pushMsg(id, { kind: "file", fileName: "notes.pdf", fileSize: "240 KB", body: "notes.pdf" });
    if (label === "GIF") pushMsg(id, { kind: "gif", body: "😂" });
    if (label === "Sticker") pushMsg(id, { kind: "sticker", body: "😎" });
    if (label === "Location") pushMsg(id, { kind: "location", body: me.city || "Current location" });
    if (label === "Contact") pushMsg(id, { kind: "contact", body: me.name + " @" + me.username });
    if (label === "Poll") pushMsg(id, { kind: "poll", body: "Where should we eat?", poll: { question: "Where should we eat?", options: ["Pizza", "Burgers", "Tacos", "Sushi"], votes: {} } });
    if (label === "View once") pushMsg(id, { kind: "photo", body: "Photo", viewOnce: true });
    ctx.render();
  });
}
function info(ctx, id) {
  const c = convo(id);
  const me = api.me();
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="topbar"><button id="back">←</button><b>Chat info</b><span></span></div>
    <div class="centerprof"><b>${ctxEsc(nameOf(c, me))}</b><div class="sub">${c.group ? c.members.length + " people" : "@" + ctxEsc(api.user(c.members.find(x => x !== me.id))?.username || "")}</div></div>
    <button class="listbtn" id="media">Shared media</button>
    <button class="listbtn" id="search">Search</button>
    <button class="listbtn" id="mute">Mute</button>
    <button class="listbtn" id="dis">Disappearing · ${ctxEsc(c.disappear)}</button>
    <button class="listbtn" id="wall">Wallpaper</button>
    ${c.group ? `<button class="listbtn" id="group">Group</button>` : `<button class="listbtn" id="block">Block</button>`}
    <button class="listbtn" id="report">Report</button>
  </div></section>`, "light");
  ctx.$("#back").onclick = () => { ui.screen = "thread"; ctx.render(); };
  ctx.$("#media").onclick = () => { ui.screen = "media"; ctx.render(); };
  ctx.$("#search").onclick = () => { ui.screen = "search"; ctx.render(); };
  ctx.$("#mute").onclick = () => mute(ctx, id);
  ctx.$("#dis").onclick = () => disappear(ctx, id);
  ctx.$("#wall").onclick = () => { mutate(db => { const cv = db.convos.find(x => x.id === id); cv.wallpaper = cv.wallpaper ? "" : "#e7f6e9"; }); ctx.render(); };
  if (ctx.$("#group")) ctx.$("#group").onclick = () => { ui.screen = "group"; ctx.render(); };
  if (ctx.$("#block")) ctx.$("#block").onclick = () => { const who = c.members.find(x => x !== me.id); mutate(db => db.blocks.push({ by: me.id, who })); ctx.toast("Blocked"); };
  ctx.$("#report").onclick = () => { mutate(db => db.reports.push({ id: "r" + Date.now(), by: me.id, target: id, reason: "chat", at: Date.now() })); ctx.toast("Reported"); };
}
function search(ctx, id) {
  const c = convo(id);
  const q = (ui.q || "").toLowerCase();
  const hits = c.messages.filter(m => !q || preview(m).toLowerCase().includes(q) || (m.body || "").toLowerCase().includes(q));
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="topbar"><button id="back">←</button><b>Search</b><span></span></div>
    <input class="chatsearch" id="sq" placeholder="Search this chat" value="${ctxEsc(ui.q)}" />
    ${hits.map(m => `<button class="listbtn" data-jump="${m.id}">${ctxEsc(preview(m))}</button>`).join("")}
  </div></section>`, "light");
  ctx.$("#back").onclick = () => { ui.screen = "thread"; ctx.render(); };
  ctx.$("#sq").oninput = (e) => { ui.q = e.target.value; ctx.render(); };
  ctx.app.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { ui.screen = "thread"; ctx.render(); setTimeout(() => jump(b.dataset.jump), 30); });
}
function media(ctx, id) {
  const c = convo(id);
  const items = c.messages.filter(m => ["photo", "video", "file", "voice", "gif"].includes(m.kind));
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="topbar"><button id="back">←</button><b>Media</b><span></span></div>
    <div class="sub">Photos ${items.filter(m => m.kind === "photo").length} · Videos ${items.filter(m => m.kind === "video").length} · Files ${items.filter(m => m.kind === "file").length} · Voice ${items.filter(m => m.kind === "voice").length}</div>
    ${items.map(m => `<div class="listbtn">${ctxEsc(preview(m))}</div>`).join("") || `<div class="empty">No media yet.</div>`}
  </div></section>`, "light");
  ctx.$("#back").onclick = () => { ui.screen = "thread"; ctx.render(); };
}
function group(ctx, id) {
  const c = convo(id);
  const g = c.group;
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="topbar"><button id="back">←</button><b>Group</b><span></span></div>
    <input class="field" id="gname" value="${ctxEsc(g.name)}" />
    ${c.members.map(uid => `<div class="listbtn">${ctxEsc(api.user(uid)?.name || uid)} ${g.admins.includes(uid) ? "· Admin" : ""}</div>`).join("")}
    <button class="btn" id="gsave" style="margin-top:8px">Save</button>
    <button class="listbtn" id="from">New group from these people</button>
    <div class="sub">Invite · ${ctxEsc(g.invite)} · Approval ${g.approval ? "on" : "off"}</div>
  </div></section>`, "light");
  ctx.$("#back").onclick = () => { ui.screen = "info"; ctx.render(); };
  ctx.$("#gsave").onclick = () => { mutate(db => { db.convos.find(x => x.id === id).group.name = ctx.$("#gname").value; }); ctx.toast("Saved"); };
  ctx.$("#from").onclick = () => { const title = prompt("Group name", "New group"); if (!title) return; const c2 = blankConvo(c.members.slice(0, 8), title); c2.group = groupMeta(title, api.me().id); mutate(db => db.convos.unshift(c2)); ui.screen = "thread"; ctx.setChat(c2.id); };
}
function saved(ctx) {
  const items = [];
  api.db().convos.forEach(c => c.messages.forEach(m => { if (m.starred || m.kept) items.push([c, m]); }));
  ctx.shell(`<section class="screen on light" style="background:#fff;color:#111"><div class="scroll page">
    <div class="topbar"><button id="back">←</button><b>Saved</b><span></span></div>
    ${items.map(([c, m]) => `<button class="listbtn" data-cv="${c.id}">${ctxEsc(nameOf(c, api.me()))} · ${ctxEsc(preview(m))}</button>`).join("") || `<div class="empty">No saved messages.</div>`}
  </div></section>`, "light");
  ctx.$("#back").onclick = () => ctx.render();
  bindRows(ctx);
}
function callScreen(ctx) {
  const call = ui.call;
  const c = convo(call.id);
  ctx.shell(`<section class="screen on" style="background:#111;color:#fff"><div class="centerprof" style="padding-top:80px"><b>${ctxEsc(nameOf(c, api.me()))}</b><div class="sub">${call.video ? "Video" : "Voice"} call · ${call.state}</div></div>
    <div class="row" style="justify-content:center;gap:10px"><button class="btn small" id="cmute">${call.muted ? "Unmute" : "Mute"}</button><button class="btn small" id="cend">End</button>${call.video ? `<button class="btn small" id="cshare">Share</button>` : ""}</div>
    <div class="row" style="justify-content:center;margin-top:16px">${REACTS.map(e => `<button data-cr="${e}">${e}</button>`).join("")}</div>
  </section>`);
  ctx.$("#cmute").onclick = () => { call.muted = !call.muted; ctx.render(); };
  ctx.$("#cend").onclick = () => { pushMsg(call.id, { kind: "call", body: (call.video ? "Video call" : "Voice call") + " ended" }); ui.call = null; ui.screen = "thread"; ctx.render(); };
  if (ctx.$("#cshare")) ctx.$("#cshare").onclick = () => ctx.toast("Sharing screen");
  ctx.app.querySelectorAll("[data-cr]").forEach(b => b.onclick = () => ctx.toast(b.dataset.cr));
}
function startCall(ctx, id, video) {
  ui.call = { id, video, state: "Connected", muted: false };
  pushMsg(id, { kind: "call", body: (video ? "Video call" : "Voice call") + " started" });
  ctx.render();
}
function mute(ctx, id) {
  menu(ctx, ["1 hour", "8 hours", "1 week", "Forever", "Unmute"], (label) => {
    const map = { "1 hour": 36e5, "8 hours": 8 * 36e5, "1 week": 7 * 864e5, "Forever": 3650 * 864e5, "Unmute": 0 };
    mutate(db => { db.convos.find(x => x.id === id).mutedUntil = map[label] ? Date.now() + map[label] : 0; });
    ctx.toast(label);
    ctx.render();
  });
}
function disappear(ctx, id) {
  menu(ctx, ["After viewing", "10 seconds", "24 hours", "Off"], (label) => {
    const mode = label === "After viewing" ? "after view" : label === "Off" ? "off" : label;
    mutate(db => { db.convos.find(x => x.id === id).disappear = mode; });
    ctx.toast(mode === "off" ? "Messages stay until you delete them" : "Disappears " + label.toLowerCase());
    ctx.render();
  });
}
function pick(ctx, group) {
  const sheet = ctx.$("#sheet");
  const picked = new Set();
  let title = "";
  sheet.classList.add("on");
  const draw = () => {
    sheet.innerHTML = `<div class="panel"><div class="grab"></div><b>${group ? "New group" : "New message"}</b>
      ${group ? `<input class="field" id="gtitle" placeholder="Group name" style="margin:8px 0" value="${ctxEsc(title)}" />` : ""}
      ${api.db().users.filter(u => u.id !== api.me().id).map(u => `<button class="listbtn" data-pick="${u.id}"><img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><b>@${u.username}</b>${picked.has(u.id) ? " · added" : ""}</div></button>`).join("")}
      <button class="btn" id="start">Start</button></div>`;
    if (group) ctx.$("#gtitle").oninput = (e) => { title = e.target.value; };
    sheet.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { if (group) picked.has(b.dataset.pick) ? picked.delete(b.dataset.pick) : picked.add(b.dataset.pick); else { picked.clear(); picked.add(b.dataset.pick); } draw(); });
    ctx.$("#start").onclick = () => {
      if (!picked.size) return ctx.toast("Pick someone");
      const id = ensureConvo([...picked]);
      if (group) mutate(db => { const c = db.convos.find(x => x.id === id); c.title = ctx.$("#gtitle")?.value.trim() || "Group"; c.group = groupMeta(c.title, api.me().id); });
      sheet.classList.remove("on"); ui.screen = "thread"; ctx.setChat(id);
    };
  };
  draw();
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
function menu(ctx, labels, onPick) {
  const sheet = ctx.$("#sheet");
  sheet.classList.add("on");
  sheet.innerHTML = `<div class="panel"><div class="grab"></div>${labels.map(l => `<button class="listbtn" data-l="${ctxEsc(l)}">${ctxEsc(l)}</button>`).join("")}</div>`;
  sheet.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { sheet.classList.remove("on"); onPick(b.dataset.l); });
  sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.remove("on"); };
}
function jump(id) { document.querySelector(`[data-msg="${id}"]`)?.scrollIntoView({ block: "center" }); }
