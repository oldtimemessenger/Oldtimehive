// 1:1 WebRTC voice and video. Media is peer-to-peer. Signaling is separate.
// Video reuses this session and adds a camera track. No second calling stack.

import { api, mutate } from "../store.js";
import { iceServers } from "./config.js";
import { publish, subscribe } from "./signaling.js";

const RING_MS = 45000;
let session = null;
let unsub = null;
let onChange = () => {};
let history = () => {};

export function onCallChange(fn) { onChange = fn; }
export function onCallHistory(fn) { history = fn; }
export function currentCall() { return session; }

export function installSignaling() {
  if (unsub) return;
  unsub = subscribe(onSignal);
  window.addEventListener("online", () => note("Network back"));
  window.addEventListener("offline", () => note("Network lost"));
  document.addEventListener("visibilitychange", () => {
    if (session) session.background = document.hidden;
    onChange();
  });
}

function note(text) {
  if (!session) return;
  session.detail = text;
  onChange();
}

export async function startCall(convoId, video) {
  const me = api.me();
  const c = api.db().convos.find(x => x.id === convoId);
  if (!me || !c) throw new Error("No chat");
  if (c.members.length !== 2) throw new Error("Calls are 1:1");
  const to = c.members.find(id => id !== me.id);
  if (!to || api.blocked(me.id, to)) throw new Error("Cannot call this contact");
  if (session && session.phase !== "ended") throw new Error("Already on a call");
  session = blank(convoId, to, video, "outgoing");
  onChange();
  try {
    await attachMedia(video);
    session.pc = makePc(false);
    wirePc(session.pc);
    addTracks();
    const offer = await session.pc.createOffer();
    await session.pc.setLocalDescription(offer);
    publish("invite", session.id, to, { convoId, video, offer });
    session.timer = setTimeout(() => timeout(), RING_MS);
  } catch (err) {
    session.phase = "failed";
    session.detail = err?.name === "NotAllowedError" ? "Permission denied" : (err.message || "Could not start");
    cleanupMedia();
    onChange();
  }
}

export function accept() {
  if (!session || session.phase !== "incoming") return;
  clearTimeout(session.timer);
  session.phase = "connecting";
  onChange();
  acceptAsync().catch(err => {
    session.phase = "failed";
    session.detail = err?.name === "NotAllowedError" ? "Permission denied" : (err.message || "Failed");
    publish("reject", session.id, session.peer, { reason: "failed" });
    onChange();
  });
}

async function acceptAsync() {
  await attachMedia(session.video);
  session.pc = makePc(false);
  wirePc(session.pc);
  addTracks();
  await session.pc.setRemoteDescription(session.remoteOffer);
  session.pendingIce.forEach(c => session.pc.addIceCandidate(c).catch(() => {}));
  session.pendingIce = [];
  const answer = await session.pc.createAnswer();
  await session.pc.setLocalDescription(answer);
  publish("answer", session.id, session.peer, { answer });
  publish("accept", session.id, session.peer, {});
}

export function decline() {
  if (!session) return;
  publish("reject", session.id, session.peer, { reason: "declined" });
  endLocal("declined", false);
}

export function hangup() {
  if (!session) return;
  publish("end", session.id, session.peer, {});
  endLocal("ended", true);
}

export function toggleMute() {
  if (!session) return;
  session.muted = !session.muted;
  session.localStream?.getAudioTracks().forEach(t => t.enabled = !session.muted);
  onChange();
}

export function toggleCamera() {
  if (!session) return;
  session.cameraOn = !session.cameraOn;
  session.localStream?.getVideoTracks().forEach(t => t.enabled = session.cameraOn);
  onChange();
}

export async function flipCamera() {
  if (!session?.video) return;
  session.facing = session.facing === "user" ? "environment" : "user";
  const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: session.facing }, audio: false });
  const next = cam.getVideoTracks()[0];
  const sender = session.pc?.getSenders().find(s => s.track && s.track.kind === "video");
  if (sender) await sender.replaceTrack(next);
  session.localStream?.getVideoTracks().forEach(t => t.stop());
  if (session.localStream) session.localStream.addTrack(next);
  onChange();
}

export async function addVideo() {
  if (!session || session.video) return;
  session.video = true;
  const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: session.facing }, audio: false });
  const track = cam.getVideoTracks()[0];
  session.localStream.addTrack(track);
  session.pc?.addTrack(track, session.localStream);
  session.cameraOn = true;
  onChange();
}

export function toggleSpeaker() {
  if (!session) return;
  session.speaker = !session.speaker;
  const el = document.querySelector("#ot-remote");
  if (el?.setSinkId) {
    el.setSinkId(session.speaker ? "default" : "communications").catch(() => {});
  }
  onChange();
}

export function setMinimized(v) {
  if (!session) return;
  session.minimized = v;
  onChange();
}

async function onSignal(row) {
  if (row.type === "invite") return incoming(row);
  if (!session || row.callId !== session.id) return;
  if (row.from !== session.peer) return;
  if (row.type === "answer" && session.pc) {
    await session.pc.setRemoteDescription(row.payload.answer);
    session.phase = "connecting";
  }
  if (row.type === "ice" && row.payload.candidate) {
    const cand = new RTCIceCandidate(row.payload.candidate);
    if (session.pc?.remoteDescription) session.pc.addIceCandidate(cand).catch(() => {});
    else session.pendingIce.push(cand);
  }
  if (row.type === "ringing") session.phase = "ringing";
  if (row.type === "accept") session.phase = "connecting";
  if (row.type === "reject") endLocal(row.payload.reason === "busy" ? "busy" : "declined", false);
  if (row.type === "end") endLocal("ended", true);
  onChange();
}

function incoming(row) {
  const me = api.me();
  if (!me || row.to !== me.id) return;
  if (!api.user(row.from) || api.blocked(me.id, row.from)) return;
  if (session && session.phase !== "ended") {
    publish("reject", row.callId, row.from, { reason: "busy" });
    return;
  }
  session = blank(row.payload.convoId, row.from, !!row.payload.video, "incoming");
  session.id = row.callId;
  session.remoteOffer = row.payload.offer;
  publish("ringing", session.id, session.peer, {});
  session.timer = setTimeout(() => {
    publish("reject", session.id, session.peer, { reason: "timeout" });
    endLocal("missed", false);
  }, RING_MS);
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    const who = api.user(row.from)?.name || "Someone";
    new Notification("Old Time", { body: who + " is calling" });
  } else if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  mutate(db => {
    db.notes = db.notes || [];
    db.notes.unshift({ id: "n" + Date.now(), user: me.id, kind: "call", actor: row.from, body: "Incoming call", created: Date.now() });
  });
  onChange();
}

function blank(convoId, peer, video, phase) {
  return {
    id: "call" + Date.now(), convoId, peer, video, phase,
    muted: false, cameraOn: !!video, speaker: true, facing: "user",
    minimized: false, background: document.hidden, started: 0,
    detail: "", localStream: null, remoteStream: new MediaStream(),
    pc: null, pendingIce: [], remoteOffer: null, timer: null, usedRelay: false
  };
}

function makePc(relay) {
  const pc = new RTCPeerConnection(iceServers(relay));
  session.usedRelay = relay;
  return pc;
}

function wirePc(pc) {
  pc.onicecandidate = (e) => {
    if (e.candidate) publish("ice", session.id, session.peer, { candidate: e.candidate });
  };
  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach(t => session.remoteStream.addTrack(t));
    onChange();
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === "connected") {
      session.phase = "connected";
      session.started = session.started || Date.now();
      session.detail = session.usedRelay ? "Connected via relay" : "Connected";
      clearTimeout(session.timer);
    }
    if (s === "disconnected") session.detail = "Reconnecting";
    if (s === "failed") fallbackRelay();
    onChange();
  };
}

async function fallbackRelay() {
  if (!session || session.usedRelay) {
    if (session) session.detail = "Could not connect";
    onChange();
    return;
  }
  session.detail = "Trying relay";
  session.usedRelay = true;
  onChange();
  try {
    session.pc?.close();
    session.pc = makePc(true);
    wirePc(session.pc);
    addTracks();
    const offer = await session.pc.createOffer();
    await session.pc.setLocalDescription(offer);
    publish("invite", session.id, session.peer, { convoId: session.convoId, video: session.video, offer, retry: true });
  } catch {
    session.detail = "Could not connect";
    onChange();
  }
}

async function attachMedia(video) {
  const constraints = { audio: true, video: video ? { facingMode: "user" } : false };
  session.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  session.cameraOn = !!video;
}

function addTracks() {
  session.localStream.getTracks().forEach(t => session.pc.addTrack(t, session.localStream));
}

function timeout() {
  if (!session || session.phase === "connected") return;
  publish("end", session.id, session.peer, { reason: "timeout" });
  endLocal("no answer", false);
}

function endLocal(reason, log) {
  if (!session) return;
  clearTimeout(session.timer);
  const snap = session;
  session = null;
  snap.pc?.close();
  cleanupStream(snap.localStream);
  if (log && snap.started) {
    const sec = Math.round((Date.now() - snap.started) / 1000);
    const label = (snap.video ? "Video call" : "Voice call") + " · " + fmt(sec);
    history(snap.convoId, label);
  } else if (log) {
    history(snap.convoId, (snap.video ? "Video call" : "Voice call") + " · " + reason);
  }
  onChange();
}

function cleanupMedia() {
  cleanupStream(session?.localStream);
}
function cleanupStream(stream) { stream?.getTracks().forEach(t => t.stop()); }
function fmt(s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

export function duration() {
  if (!session?.started) return "0:00";
  return fmt(Math.round((Date.now() - session.started) / 1000));
}
