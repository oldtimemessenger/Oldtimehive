# Old Time

Mobile-first social app: vertical video, photos, carousels, text posts, stories, chat, and a location map.

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173

Sign in with any email, or use Continue with Google / Apple. Sample account: `nova@oldtime.app` / `oldtime`.

State is stored in `localStorage` under `oldtime-v1`. The services in `app/store.js` are the seam for a later Supabase backend. See `supabase/schema.sql`.

No Pace in V1.

## Calls and voice notes

Voice notes use the microphone and MediaRecorder. 1:1 calls use WebRTC. Media is not sent through this app's backend. Signaling uses a local channel, and Supabase `call_signals` when `oldtime-supabase-url` and `oldtime-supabase-anon-key` are set. TURN is optional via `localStorage.oldtime-turn` and is only used if a direct connection fails.

Two-account test on one machine: sign in, open a second tab with `?as=june`.
