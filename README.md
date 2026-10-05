# Old Time

Mobile-first social app: vertical video, photos, carousels, text posts, stories, and chat.

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173

Sign in with a sample account (`nova@oldtime.app` / `oldtime` or `you@oldtime.app` / `oldtime`), or create a local account. Google / Apple buttons open clearly labeled demo accounts, not OAuth sign-in.

State is stored in `localStorage` under `oldtime-v1`. The services in `app/store.js` are the seam for a later Supabase backend. See `supabase/schema.sql`.

No Pace in V1.

## Install on a phone

The app can be added to a phone's home screen as a progressive web app (PWA). Service workers require HTTPS, except on localhost; opening `index.html` directly as a file does not enable installation or offline caching.

- On iPhone or iPad, open the HTTPS site in Safari, tap Share, then choose **Add to Home Screen**.
- On Android, open the HTTPS site in Chrome and choose **Install app** or **Add to Home screen** from the browser menu.

The service worker caches the app shell so it can reopen offline. Posts, accounts, and messages remain local to that browser, and externally hosted media and fonts may not be available offline. A PWA is still a website; it does not create App Store or Google Play listings.

## Icons, emoji, and screens

Interface controls use shared, accessible SVG icons in `app/icons.js`; emoji remain colorful content, not navigation icons. The emoji picker supports categories, recent selections, country-name/code flag search, skin tones on supported gestures, and insertion at the cursor. It is available in chat, reactions, stickers, comments, captions, and profile bios. Noto Color Emoji provides a cross-platform font fallback when Google Fonts is reachable; native emoji fonts remain available offline. Artwork can vary by platform and is not Instagram/WhatsApp proprietary artwork.

Profiles include Posts, Videos, Saved, messaging, block/report, avatar editing, and a Settings entry. Carousels have photo navigation, videos have mute controls, and post/profile links use this app's current origin. Chat supports actual photo/video/GIF/document uploads, voice notes, custom polls, and shared-media playback. Uploads are limited to 2 MB per file in this local demo; total browser storage is also limited. Storage failures are surfaced rather than silently discarding changes.

## Production status

This is a **local prototype, not a production-ready multi-user service**. Accounts, passwords, messages, reports, and media are stored in browser storage; do not use real credentials or sensitive data. Hiding a chat is an organizational feature, not a security lock. Local privacy filters are not a substitute for server-side authorization. Reports are saved locally, not sent to a moderation/support team.

The Live screen is an explicitly labeled camera/microphone preview; it does not broadcast to remote viewers. Password recovery is unavailable until verified email recovery is connected. Message status changes to “sent” locally and is marked read only when the recipient opens the chat, not by a simulated timer. Same-origin tabs receive storage updates, but there is no server-backed messaging synchronization.

Before public launch, implement server-backed authentication/OAuth and verified recovery, per-user authorized database/storage access, media hosting, real-time messaging/presence and delivery acknowledgements, live broadcast infrastructure, moderation/report handling, notification delivery/preferences, and published terms/privacy policies. The optional call-signaling integration does not provide those services. Audit the SQL schema and policies before deployment.

No package manager, build, lint, or test scripts are configured. Serve the app as above; validate JavaScript syntax with `node --check` and smoke-check the browser flows. Sample media and web fonts require access to their external providers; unavailable media displays a fallback instead of a blank screen.

Before release, verify sign-in, feed, chat, uploads, and keyboard behavior on physical iOS and Android devices, including small screens and safe-area insets. This repository does not include native iOS/Android projects or a production backend; store distribution and multi-user service requirements are separate work.

## Calls and voice notes

Voice notes use the microphone and MediaRecorder. 1:1 calls use WebRTC. Media is not sent through this app's backend. Signaling uses a local channel, and Supabase `call_signals` when `oldtime-supabase-url` and `oldtime-supabase-anon-key` are set. TURN is optional via `localStorage.oldtime-turn` and is only used if a direct connection fails.

Two-account test on one machine: sign in, open a second tab with `?as=june`.
