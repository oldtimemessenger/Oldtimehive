import { api, mutate } from "./store.js";
import { icons as ic } from "./icons.js";

let room = null;
let stream = null;
let facing = "user";
let cameraVersion = 0;

function esc(s = "") {
  return String(s).replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;");
}

export function openLive(ctx) {
  leaveLive();
  ensure();
  ctx.shell(`<section class="screen on"><div class="scroll page">
    <div class="topbar" style="padding:8px 0"><button id="live-back" class="icon" aria-label="Back">${ic.back}</button><b>Live camera</b></div>
    <div class="empty">Preview your camera and microphone locally. Public broadcasting and remote viewers require a streaming backend and are not connected.</div>
    <button id="golive" class="btn">Start camera preview</button>
  </div></section>`);
  ctx.$("#live-back").onclick = () => { leaveLive(); ctx.render(); };
  ctx.$("#golive").onclick = async () => {
    const button = ctx.$("#golive");
    button.disabled = true;
    try { await start(ctx); }
    finally { if (button.isConnected) button.disabled = false; }
  };
}

function ensure() {
  mutate(db => {
    db.lives = db.lives || [];
  });
}

async function start(ctx) {
  const me = api.me();
  const id = "live" + crypto.randomUUID();
  mutate(db => db.lives.unshift({ id, host: me.id, title: "Camera preview", live: true, viewers: 0, camera: true, muted: false, comments: [] }));
  room = api.db().lives.find(l => l.id === id);
  await camera(true);
  if (room?.id !== id) return;
  draw(ctx, true);
  if (!stream) ctx.toast("Camera unavailable. Check permissions and use HTTPS or localhost.");
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
      <div><b>${esc(u.name)}</b><div class="sub">Local preview · ${room.muted ? "mic off" : "mic on"}</div></div>
      <span class="livepill">PREVIEW</span>
    </div>
    <div class="ft-pip" id="pip">${host ? `<video id="selfvid" autoplay playsinline muted></video>` : `<img src="${me.avatar}" alt="" />`}</div>
    <div class="ft-comments" id="comments">${room.comments.map(c => `<div><b>${esc(api.user(c.author)?.username || "")}</b> ${esc(c.body)}</div>`).join("")}</div>
    <form class="ft-say" id="say"><input id="line" placeholder="Say something" /><button type="submit">Send</button></form>
    <div class="ft-controls">
      <button type="button" id="ftmute" aria-label="${room.muted ? "Unmute" : "Mute"} microphone">${ic.mic}</button>
      <button type="button" id="ftcam" aria-label="${room.camera ? "Turn camera off" : "Turn camera on"}">${ic.camera}</button>
      <button type="button" id="ftflip" aria-label="Flip camera">${ic.flip}</button>
      <button type="button" id="ftend" aria-label="End camera preview">${ic.close}</button>
    </div>
  </section>`);
  const main = ctx.$("#mainvid");
  const self = ctx.$("#selfvid");
  if (stream && room.camera) {
    if (host && self) self.srcObject = stream;
    if (host && main) main.srcObject = stream;
  }
  ctx.$("#ftback").onclick = () => leave(ctx, host);
  ctx.$("#ftend").onclick = () => leave(ctx, host);
  ctx.$("#ftmute").onclick = () => { room.muted = !room.muted; stream?.getAudioTracks().forEach(t => t.enabled = !room.muted); draw(ctx, host); };
  ctx.$("#ftcam").onclick = async () => { room.camera = !room.camera; if (room.camera) await camera(true); else stop(); if (room) draw(ctx, host); };
  ctx.$("#ftflip").onclick = async () => { facing = facing === "user" ? "environment" : "user"; if (room.camera) await camera(true); if (room) draw(ctx, host); };
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
  const version = cameraVersion;
  if (!on || !navigator.mediaDevices?.getUserMedia) { if (room) room.camera = false; return; }
  try {
    const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
    if (!room || version !== cameraVersion) { next.getTracks().forEach(t => t.stop()); return; }
    stream = next;
    stream.getAudioTracks().forEach(t => t.enabled = !room.muted);
  } catch {
    if (version === cameraVersion) {
      stream = null;
      if (room) room.camera = false;
    }
  }
}
function stop() {
  cameraVersion++;
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}
function leave(ctx, end) {
  leaveLive();
  ctx.render();
}
export function leaveLive() {
  stop();
  if (room) mutate(db => { const l = db.lives.find(x => x.id === room.id); if (l && l.host === api.me()?.id) l.live = false; });
  room = null;
}
window.addEventListener("pagehide", leaveLive);
