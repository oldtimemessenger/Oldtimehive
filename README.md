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
