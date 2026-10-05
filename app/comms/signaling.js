// Lightweight signaling. Audio never rides this channel.
// Local transport: shared localStorage + BroadcastChannel (same origin).
// Optional transport: Supabase table call_signals when anon config is set.
// Caller id is the signed-in session, not a client-supplied display name.

import { api } from "../store.js";
import { supabaseConfig } from "./config.js";

const KEY = "oldtime-signals";
const bus = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("oldtime-signals") : null;
const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(rows) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(-200)));
}

export function publish(type, callId, to, payload) {
  const me = api.me();
  if (!me) throw new Error("Not signed in");
  if (!to || to === me.id) throw new Error("Bad callee");
  if (!api.user(to)) throw new Error("Unknown contact");
  const row = {
    id: "sig" + Date.now() + Math.random().toString(16).slice(2, 6),
    type, callId, from: me.id, to, payload: payload || {}, at: Date.now()
  };
  const rows = read();
  rows.push(row);
  write(rows);
  bus?.postMessage(row);
  mirrorSupabase(row);
  return row;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(row) {
  const me = api.me();
  if (!me || row.to !== me.id) return;
  if (!api.user(row.from)) return;
  listeners.forEach(fn => fn(row));
}

bus?.addEventListener("message", (e) => emit(e.data));
window.addEventListener("storage", (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try {
    const rows = JSON.parse(e.newValue);
    emit(rows[rows.length - 1]);
  } catch { /* ignore */ }
});

async function mirrorSupabase(row) {
  const cfg = supabaseConfig();
  if (!cfg) return;
  try {
    await fetch(cfg.url + "/rest/v1/call_signals", {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    });
  } catch { /* local bus still delivered */ }
}

export function pollSupabase() {
  const cfg = supabaseConfig();
  const me = api.me();
  if (!cfg || !me) return;
  const since = new Date(Date.now() - 60000).toISOString();
  fetch(cfg.url + "/rest/v1/call_signals?to=eq." + encodeURIComponent(me.id) + "&at=gte." + since + "&select=*", {
    headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key }
  }).then(r => r.ok ? r.json() : []).then(rows => {
    (rows || []).forEach(emit);
  }).catch(() => {});
}
