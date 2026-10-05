import { api } from "../store.js";
import { startCall, accept, decline, hangup, toggleMute, toggleCamera, flipCamera, toggleSpeaker, setMinimized, currentCall, onCallChange, onCallHistory, installSignaling, duration } from "./calls.js";
import { openVoiceNote, voiceBody, bindVoice } from "./voice-notes.js";
import { pollSupabase } from "./signaling.js";

let ctxRef = { toast() {} };
let tick = null;

export function mountComms(ctx) {
  ctxRef = ctx || ctxRef;
  installSignaling();
  onCallHistory((convoId, label) => {
    import("../chat.js").then(m => m.logCall(convoId, label));
  });
  onCallChange(draw);
  if (!tick) tick = setInterval(() => { pollSupabase(); if (currentCall()) draw(); }, 1000);
  draw();
}

export function placeCall(ctx, convoId, video) {
  ctxRef = ctx;
  startCall(convoId, video).catch(err => ctx.toast(err.message || "Call failed"));
}

export { openVoiceNote, voiceBody, bindVoice };

function draw() {
  let root = document.getElementById("ot-call");
  const call = currentCall();
  if (!call) { root?.remove(); return; }
  if (!root) {
    root = document.createElement("div");
    root.id = "ot-call";
    document.body.appendChild(root);
  }
  const peer = api.user(call.peer);
  const name = peer?.name || "Contact";
  if (call.minimized) {
    root.className = "ot-call min";
    root.innerHTML = `<button id="ot-restore">${name} · ${call.phase} · ${duration()}</button>`;
    root.querySelector("#ot-restore").onclick = () => setMinimized(false);
    attachStreams(root, call);
    return;
  }
  root.className = "ot-call";
  root.innerHTML = `<div class="ot-card">
    <video id="ot-remote" autoplay playsinline></video>
    <video id="ot-local" autoplay playsinline muted></video>
    <div class="ot-meta"><b>${name}</b><div>${call.video ? "Video" : "Voice"} · ${call.phase} · ${duration()}</div><div>${call.detail || ""}</div></div>
    <div class="ot-actions">
      ${call.phase === "incoming" ? `<button id="ot-yes">Accept</button><button id="ot-no">Decline</button>` : ""}
      ${call.phase !== "incoming" ? `<button id="ot-mute">${call.muted ? "Unmute" : "Mute"}</button>` : ""}
      ${call.phase !== "incoming" ? `<button id="ot-spk">${call.speaker ? "Speaker" : "Earpiece"}</button>` : ""}
      ${call.video ? `<button id="ot-cam">${call.cameraOn ? "Camera off" : "Camera on"}</button><button id="ot-flip">Flip</button>` : `<button id="ot-addcam">Add video</button>`}
      <button id="ot-min">Minimize</button>
      ${call.phase !== "incoming" ? `<button id="ot-end">End</button>` : ""}
    </div>
  </div>`;
  root.querySelector("#ot-yes")?.addEventListener("click", accept);
  root.querySelector("#ot-no")?.addEventListener("click", decline);
  root.querySelector("#ot-mute")?.addEventListener("click", toggleMute);
  root.querySelector("#ot-spk")?.addEventListener("click", toggleSpeaker);
  root.querySelector("#ot-cam")?.addEventListener("click", toggleCamera);
  root.querySelector("#ot-flip")?.addEventListener("click", () => flipCamera());
  root.querySelector("#ot-addcam")?.addEventListener("click", () => import("./calls.js").then(m => m.addVideo()));
  root.querySelector("#ot-min")?.addEventListener("click", () => setMinimized(true));
  root.querySelector("#ot-end")?.addEventListener("click", hangup);
  attachStreams(root, call);
}

function attachStreams(root, call) {
  const remote = root.querySelector("#ot-remote");
  const local = root.querySelector("#ot-local");
  if (remote && remote.srcObject !== call.remoteStream) remote.srcObject = call.remoteStream;
  if (local && call.localStream && local.srcObject !== call.localStream) local.srcObject = call.localStream;
}
