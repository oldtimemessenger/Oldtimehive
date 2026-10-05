// Voice notes use MediaRecorder, not WebRTC. Record → preview → compress → upload → chat message.

import { supabaseConfig } from "./config.js";
import { api } from "../store.js";

const cache = new Map();
let cancelRecording = null;

export function closeVoiceNote() {
  cancelRecording?.();
  players.forEach(p => p.audio.pause());
}

export function formatDur(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

export function openVoiceNote(ctx, convoId, pushMsg) {
  const sheet = ctx.$("#sheet");
  sheet.classList.add("on");
  const state = { rec: null, chunks: [], blob: null, url: null, peaks: [], paused: false, started: 0, elapsed: 0, timer: null, stream: null, cancelled: false, preview: null };
  const draw = () => {
    sheet.innerHTML = `<div class="panel vn-panel">
      <div class="grab"></div>
      <b>Voice note</b>
      <div class="vn-time" id="vn-time">${formatDur(state.elapsed)}</div>
      <div class="vn-wave" id="vn-wave">${bars(state.peaks)}</div>
      <div class="row" style="justify-content:center;gap:8px;margin-top:10px">
        ${!state.rec && !state.blob ? `<button class="btn" id="vn-rec">Record</button>` : ""}
        ${state.rec && !state.paused ? `<button class="btn small" id="vn-pause">Pause</button>` : ""}
        ${state.rec && state.paused ? `<button class="btn small" id="vn-resume">Resume</button>` : ""}
        ${state.rec ? `<button class="btn small" id="vn-stop">Preview</button>` : ""}
        ${state.blob ? `<button class="btn small" id="vn-play">Play preview</button><button class="btn" id="vn-send">Send</button>` : ""}
        <button class="btn small" id="vn-cancel">Cancel</button>
      </div>
      <div class="sub" id="vn-err"></div>
    </div>`;
    sheet.onclick = (e) => { if (e.target === sheet) cancel(); };
    ctx.$("#vn-cancel").onclick = cancel;
    if (ctx.$("#vn-rec")) ctx.$("#vn-rec").onclick = () => record().catch(err => fail(err));
    if (ctx.$("#vn-pause")) ctx.$("#vn-pause").onclick = () => { state.rec.pause(); state.paused = true; stopTick(); draw(); };
    if (ctx.$("#vn-resume")) ctx.$("#vn-resume").onclick = () => { state.rec.resume(); state.paused = false; startTick(); draw(); };
    if (ctx.$("#vn-stop")) ctx.$("#vn-stop").onclick = () => state.rec.stop();
    if (ctx.$("#vn-play")) ctx.$("#vn-play").onclick = () => { state.preview?.pause(); state.preview = new Audio(state.url); state.preview.play().catch(fail); };
    if (ctx.$("#vn-send")) ctx.$("#vn-send").onclick = () => { ctx.$("#vn-send").disabled = true; send().catch(err => { fail(err); if (ctx.$("#vn-send")) ctx.$("#vn-send").disabled = false; }); };
  };
  function bars(peaks) {
    const src = peaks.length ? peaks : Array(24).fill(0.15);
    return src.slice(-32).map(p => `<i style="height:${Math.max(8, Math.round(p * 36))}px"></i>`).join("");
  }
  function fail(err) {
    const el = ctx.$("#vn-err");
    if (el) el.textContent = err?.name === "NotAllowedError" ? "Microphone permission denied" : (err?.message || "Could not record");
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is not available");
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (state.cancelled || !sheet.isConnected) { state.stream.getTracks().forEach(t => t.stop()); return; }
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    state.rec = new MediaRecorder(state.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
    state.chunks = [];
    state.rec.ondataavailable = (e) => { if (e.data.size) state.chunks.push(e.data); };
    state.rec.onstop = () => {
      stopTick();
      state.stream.getTracks().forEach(t => t.stop());
      if (state.cancelled || !sheet.isConnected) { state.rec = null; return; }
      state.blob = new Blob(state.chunks, { type: state.rec.mimeType || "audio/webm" });
      state.url = URL.createObjectURL(state.blob);
      state.rec = null;
      draw();
    };
    state.rec.start(200);
    state.started = Date.now();
    startTick();
    draw();
  }
  function startTick() {
    state.timer = setInterval(() => {
      state.elapsed += 0.2;
      state.peaks.push(0.25 + Math.random() * 0.75);
      const t = ctx.$("#vn-time");
      const w = ctx.$("#vn-wave");
      if (t) t.textContent = formatDur(state.elapsed);
      if (w) w.innerHTML = bars(state.peaks);
    }, 200);
  }
  function stopTick() { clearInterval(state.timer); state.timer = null; }
  function cancel() {
    state.cancelled = true;
    stopTick();
    state.preview?.pause();
    if (state.rec && state.rec.state !== "inactive") state.rec.stop();
    state.stream?.getTracks().forEach(t => t.stop());
    if (state.url) URL.revokeObjectURL(state.url);
    sheet.classList.remove("on");
    cancelRecording = null;
  }
  async function send() {
    if (!state.blob?.size) throw new Error("Record a voice note first");
    state.preview?.pause();
    const id = "m" + crypto.randomUUID();
    const media = await uploadVoice(state.blob, id);
    if (state.cancelled) return;
    pushMsg(convoId, { id, kind: "voice", body: "Voice message", media, duration: formatDur(state.elapsed), status: "sending", peaks: state.peaks.slice(-32), fileSize: Math.round(state.blob.size / 1024) + " KB" });
    if (state.url) URL.revokeObjectURL(state.url);
    sheet.classList.remove("on");
    ctx.render();
  }
  cancelRecording = cancel;
  draw();
}

async function uploadVoice(blob, id) {
  const cfg = supabaseConfig();
  if (cfg) {
    const res = await fetch(cfg.url + "/storage/v1/object/voice-notes/" + id + ".webm", {
      method: "POST",
      headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key, "Content-Type": blob.type || "audio/webm", "x-upsert": "true" },
      body: blob
    });
    if (!res.ok) throw new Error("Upload failed");
    return cfg.url + "/storage/v1/object/public/voice-notes/" + id + ".webm";
  }
  if (blob.size > 2 * 1024 * 1024) throw new Error("Voice note is too large for this local demo");
  return blobToData(blob);
}

function blobToData(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Upload failed"));
    r.readAsDataURL(blob);
  });
}

export function voiceBody(m) {
  const peaks = (m.peaks || []).slice(-24);
  const bars = (peaks.length ? peaks : Array(16).fill(0.3)).map(p => `<i style="height:${Math.max(6, Math.round(p * 22))}px"></i>`).join("");
  return `<div class="vn-msg" data-voice="${m.id}">
    <button type="button" data-vplay="${m.id}">Play</button>
    <div class="vn-wave" data-vwave="${m.id}">${bars}</div>
    <span>${m.duration || "0:00"}</span>
    <button type="button" data-vspeed="${m.id}">1×</button>
  </div>`;
}

const players = new Map();

export function bindVoice(root) {
  root.querySelectorAll("[data-vplay]").forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); toggle(btn.dataset.vplay, btn); };
  });
  root.querySelectorAll("[data-vspeed]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const p = players.get(btn.dataset.vspeed);
      const next = !p || p.audio.playbackRate === 1 ? 1.5 : p.audio.playbackRate === 1.5 ? 2 : 1;
      if (p) p.audio.playbackRate = next;
      btn.textContent = next + "×";
      btn.dataset.rate = String(next);
    };
  });
}

function mediaOf(id) {
  if (cache.has(id)) return cache.get(id);
  const message = api.db().convos.filter(c => c.members.includes(api.me()?.id)).flatMap(c => c.messages).find(m => m.id === id);
  if (message?.media) return message.media;
  const stored = localStorage.getItem("oldtime-voice-" + id);
  return stored || "";
}

function toggle(id, btn) {
  let p = players.get(id);
  if (!p) {
    const src = mediaOf(id) || btn.closest("[data-voice]")?.dataset.src;
    const msgSrc = src;
    if (!msgSrc) { btn.textContent = "Retry"; return; }
    const audio = new Audio(msgSrc);
    audio.playbackRate = Number(btn.parentElement.querySelector("[data-vspeed]")?.dataset.rate || 1);
    audio.ontimeupdate = () => {
      const wave = btn.parentElement.querySelector("[data-vwave]");
      if (wave && audio.duration) wave.style.setProperty("--p", (audio.currentTime / audio.duration * 100) + "%");
    };
    audio.onended = () => { btn.textContent = "Play"; };
    p = { audio };
    players.set(id, p);
  }
  if (p.audio.paused) { p.audio.play().then(() => { btn.textContent = "Pause"; }).catch(() => { btn.textContent = "Unavailable"; }); }
  else { p.audio.pause(); btn.textContent = "Play"; }
}

export async function retryVoice(ctx, convoId, messageId) {
  const { api, mutate } = await import("../store.js");
  const m = api.db().convos.find(c => c.id === convoId)?.messages.find(x => x.id === messageId);
  if (!m) return;
  ctx.toast("Nothing cached to retry");
}
