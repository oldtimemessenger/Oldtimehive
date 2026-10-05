// Public STUN only. TURN is optional and never baked in.
// Set later with localStorage oldtime-turn = { urls, username, credential }
// or window.OLD_TIME_TURN. Point urls at a self-hosted coturn when ready.

export const STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302"
];

export function turnConfig() {
  try {
    if (window.OLD_TIME_TURN) return window.OLD_TIME_TURN;
    const raw = localStorage.getItem("oldtime-turn");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function iceServers(preferRelay) {
  const servers = [{ urls: STUN_URLS }];
  const turn = turnConfig();
  if (turn?.urls) {
    servers.push({
      urls: turn.urls,
      username: turn.username || "",
      credential: turn.credential || ""
    });
  }
  return {
    iceServers: servers,
    iceTransportPolicy: preferRelay && turn?.urls ? "relay" : "all"
  };
}

export function supabaseConfig() {
  try {
    const url = window.OLD_TIME_SUPABASE_URL || localStorage.getItem("oldtime-supabase-url") || "";
    const key = window.OLD_TIME_SUPABASE_ANON_KEY || localStorage.getItem("oldtime-supabase-anon-key") || "";
    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ""), key };
  } catch {
    return null;
  }
}
