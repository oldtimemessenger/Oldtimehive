import { api, mutate } from "./store.js";

let room = null;
let stream = null;
let facing = "user";

function esc(s = "") {
  return String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;");
}

export function openLive(ctx) {
  ensure();
  const lives = api.db().lives.filter(l => l.live);
  ctx.shell(`<section class="screen on"><div class="scroll page">
    <div class="topbar" style="padding:8px 0"><b>Live</b><button id="golive" class="btn small">Go Live</button></div>
    ${lives.map(l => `<button class="listbtn" data-watch="${l.id}"><img src="${api.user(l.host).avatar}" style="width:48px;height:48px;border-radius:50%;object-fit:cover" /><div><b>${esc(api.user(l.host).name)}</b><div class="sub">${esc(l.title)} · ${l.viewers} watching</div></div></button>`).join("") || `<div class="empty">No one is live. Go live to start.</div>`}
  </div></section>`);
  ctx.$("#golive").onclick = () => start(ctx);
  ctx.app.querySelectorAll("[data-watch]").forEach(b => b.onclick = () => watch(ctx, b.dataset.watch));
}

function ensure() {
  mutate(db => {
    db.lives = db.lives || [{ id: "live1", host: "u1", title: "Night drive", live: true, viewers: 128, camera: true, muted: false, comments: [{ id: "lc1", author: "u2", body: "The lights look good", created: Date.now() - 6e4 }] }];
  });
}

async function start(ctx) {
  const me = api.me();
  const id = "live" + Date.now();
  mutate(db => db.lives.unshift({ id, host: me.id, title: "Live", live: true, viewers: 1, camera: true, muted: false, comments: [] }));
  room = api.db().lives.find(l => l.id === id);
  await camera(true);
  draw(ctx, true);
}

function watch(ctx, id) {
  room = api.db().lives.find(l => l.id === id);
  if (!room) return;
  mutate(db => { const l = db.lives.find(x => x.id === id); l.viewers += 1; });
  draw(ctx, false);
}

function draw(ctx, host) {
  const me = api.me();
  const u = api.user(room.host);
  ctx.shell(`<section class="screen on" style="background:#0c0c0e;color:#fff">
    <div class="ft-stage" id="stage">
      <video id="mainvid" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;${room.camera ? "" : "display:none"}"></video>
      <div id="camoff" style="${room.camera ? "display:none" : "display:grid"};place-items:center;height:100%;font-size:22px">Camera off</div>
    </div>
    <div class="ft-top">
      <button id="ftback">←</button>
      <div><b>${esc(u.name)}</b><div class="sub">${room.viewers} watching · ${room.muted ? "mic off" : "mic on"}</div></div>
      <span class="livepill">LIVE</span>
    </div>
    <div class="ft-pip" id="pip">${host ? `<video id="selfvid" autoplay playsinline muted></video>` : `<img src="${me.avatar}" alt="" />`}</div>
    <div class="ft-comments" id="comments">${room.comments.map(c => `<div><b>${esc(api.user(c.author)?.username || "")}</b> ${esc(c.body)}</div>`).join("")}</div>
    <form class="ft-say" id="say"><input id="line" placeholder="Say something" /><button type="submit">Send</button></form>
    <div class="ft-controls">
      <button type="button" id="ftmute">${room.muted ? "Unmute" : "Mute"}</button>
      <button type="button" id="ftcam">${room.camera ? "Camera off" : "Camera on"}</button>
      <button type="button" id="ftflip">Flip</button>
      <button type="button" id="ftend">End</button>
    </div>
  </section>`);
  const main = ctx.$("#mainvid");
  const self = ctx.$("#selfvid");
  if (stream && room.camera) {
    if (host && self) self.srcObject = stream;
    if (host && main) main.srcObject = stream;
  }
  ctx.$("#ftback").onclick = () => leave(ctx, false);
  ctx.$("#ftend").onclick = () => leave(ctx, host);
  ctx.$("#ftmute").onclick = () => { room.muted = !room.muted; stream?.getAudioTracks().forEach(t => t.enabled = !room.muted); draw(ctx, host); };
  ctx.$("#ftcam").onclick = async () => { room.camera = !room.camera; if (room.camera) await camera(true); else stop(); draw(ctx, host); };
  ctx.$("#ftflip").onclick = async () => { facing = facing === "user" ? "environment" : "user"; if (room.camera) await camera(true); draw(ctx, host); };
  ctx.$("#say").onsubmit = (e) => {
    e.preventDefault();
    const body = ctx.$("#line").value.trim();
    if (!body) return;
    mutate(db => db.lives.find(x => x.id === room.id).comments.push({ id: "lc" + Date.now(), author: me.id, body, created: Date.now() }));
    room = api.db().lives.find(x => x.id === room.id);
    draw(ctx, host);
  };
}

async function camera(on) {
  stop();
  if (!on || !navigator.mediaDevices?.getUserMedia) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
  } catch {
    stream = null;
    if (room) room.camera = false;
  }
}
function stop() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}
function leave(ctx, end) {
  if (end && room) mutate(db => { const l = db.lives.find(x => x.id === room.id); if (l && l.host === api.me().id) l.live = false; });
  stop();
  room = null;
  ctx.render();
}
