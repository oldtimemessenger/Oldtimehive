const KEY = "oldtime-v1";
const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;
const av = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&q=70`;
const V = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4"
];

export function seed() {
  return {
    session: null,
    settings: { readReceipts: true, lastSeen: "everyone" },
    users: [
      { id: "u1", username: "nova", name: "Nova Hale", bio: "Night drives and one-take clips.", avatar: av("photo-1524504388940-b1c1722653e1"), city: "Miami", verified: true, private: false, followers: ["me"], following: [], likes: 0, email: "nova@oldtime.app", password: "oldtime" },
      { id: "u2", username: "june", name: "June Park", bio: "Food, windows, late light.", avatar: av("photo-1544005313-94ddf0286df2"), city: "Los Angeles", verified: false, private: false, followers: [], following: ["me"], likes: 0, email: "june@oldtime.app", password: "oldtime" },
      { id: "u3", username: "kevmay", name: "Kev May", bio: "Cars, coast roads, no script.", avatar: av("photo-1506794778202-cad84cf45f1d"), city: "Miami", verified: true, private: false, followers: [], following: [], likes: 0, email: "kev@oldtime.app", password: "oldtime" },
      { id: "u4", username: "mara", name: "Mara Cole", bio: "Fitness that fits in a lunch break.", avatar: av("photo-1531123897727-8f129e1688ce"), city: "Chicago", verified: false, private: false, followers: [], following: [], likes: 0, email: "mara@oldtime.app", password: "oldtime" },
      { id: "u5", username: "orio", name: "Orio Bennett", bio: "Short lessons, no fluff.", avatar: av("photo-1500648767791-00dcc994a43e"), city: "New York", verified: false, private: true, followers: [], following: [], likes: 0, email: "orio@oldtime.app", password: "oldtime" },
      { id: "me", username: "you", name: "You", bio: "New on Old Time.", avatar: av("photo-1534528741775-53994a69daeb"), city: "Miami", verified: false, private: false, followers: ["u2"], following: ["u1"], likes: 0, email: "you@oldtime.app", password: "oldtime", birthday: "1998-04-12" }
    ],
    requests: [],
    posts: [
      { id: "p1", author: "u1", kind: "video", caption: "Lost the exit, found the song.", tags: ["nightdrive", "miami"], media: [V[0]], sound: "Nova — City Loop", location: "Miami", likes: ["u2"], comments: [{ id: "c1", author: "u2", body: "This loop is unfair.", likes: [], replies: [], created: Date.now() - 2e6 }], saves: [], created: Date.now() - 3600e3, views: 12800, shares: 40 },
      { id: "p2", author: "u2", kind: "photo", caption: "Golden hour on the fire escape.", tags: ["losangeles", "light"], media: [img("photo-1500530855697-b586d89ba3ee")], sound: "Original audio", location: "Los Angeles", likes: ["u1", "u3"], comments: [], saves: [], created: Date.now() - 7200e3, views: 4200, shares: 12 },
      { id: "p3", author: "u3", kind: "carousel", caption: "Coast road, three frames.", tags: ["cars", "travel"], media: [img("photo-1492144534655-ae79c964c9d7"), img("photo-1469474968028-56623f02e42e"), img("photo-1507525428034-b723cf961d3e")], sound: "Kev — Windows Down", location: "Miami", likes: [], comments: [], saves: [], created: Date.now() - 9000e3, views: 2100, shares: 4 },
      { id: "p4", author: "u4", kind: "video", caption: "Twelve minutes. No excuses.", tags: ["fitness"], media: [V[1]], sound: "Mara — Count In", location: "Chicago", likes: ["u1"], comments: [], saves: [], created: Date.now() - 14000e3, views: 6700, shares: 18 },
      { id: "p5", author: "u5", kind: "text", caption: "Write the thing before the day writes you.", tags: ["notes"], media: [], color: "linear-gradient(160deg,#1b140c,#3a2a18)", sound: "", location: "New York", likes: [], comments: [], saves: [], created: Date.now() - 20000e3, views: 890, shares: 2 },
      { id: "p6", author: "u2", kind: "photo", caption: "Late noodles, no filter.", tags: ["food"], media: [img("photo-1504674900247-0877df9cc836")], sound: "Kitchen noise", location: "Los Angeles", likes: [], comments: [], saves: [], created: Date.now() - 26000e3, views: 1500, shares: 6 },
      { id: "p7", author: "u3", kind: "video", caption: "Dirt, then pavement, then the chorus.", tags: ["cars", "miami"], media: [V[3]], sound: "Kev — Outback", location: "Miami", likes: ["u4"], comments: [], saves: [], created: Date.now() - 3e6, views: 3400, shares: 9 }
    ],
    stories: [
      { id: "s1", author: "u1", kind: "photo", media: img("photo-1514525253161-7a46d19cd819"), text: "still out", created: Date.now() - 2e6 },
      { id: "s2", author: "u3", kind: "photo", media: img("photo-1449824913935-59a10b8d2000"), text: "miami tonight", created: Date.now() - 4e6 },
      { id: "s3", author: "u4", kind: "text", media: "", text: "rest day, still counting", color: "#243044", created: Date.now() - 8e6 }
    ],
    convos: [
      { id: "cv1", members: ["me", "u1"], messages: [{ id: "m1", author: "u1", body: "You catching the drive later?", created: Date.now() - 5e6, read: true }] },
      { id: "cv2", members: ["me", "u2", "u3"], title: "Coast crew", messages: [{ id: "m2", author: "u3", body: "Map pin is up.", created: Date.now() - 9e6, read: false }] }
    ],
    notes: [
      { id: "n1", user: "me", kind: "follow", actor: "u2", body: "started following you", created: Date.now() - 3e6, read: false },
      { id: "n2", user: "me", kind: "like", actor: "u1", post: "p2", body: "liked a post", created: Date.now() - 6e6, read: false }
    ],
    blocks: [],
    reports: [],
    interests: {},
    resets: []
  };
}

let db = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !raw.users) return seed();
    raw.requests = raw.requests || [];
    raw.resets = raw.resets || [];
    raw.settings = { readReceipts: true, lastSeen: "everyone", ...raw.settings };
    return raw;
  } catch { return seed(); }
}
function persist() {
  try { const value = JSON.stringify(db); if (localStorage.getItem(KEY) !== value) localStorage.setItem(KEY, value); }
  catch { throw new Error("Browser storage is full or unavailable. Remove large media or enable site storage, then try again."); }
}
export const api = {
  db: () => db,
  me: () => {
    const as = sessionStorage.getItem("oldtime-as");
    if (as) return db.users.find(u => u.id === as || u.username === as) || db.users.find(u => u.id === db.session) || null;
    return db.users.find(u => u.id === db.session) || null;
  },
  user: (id) => db.users.find(u => u.id === id) || db.users.find(u => u.username === id),
  reset: () => { db = seed(); persist(); },
  signup(form) {
    const username = (form.username || "").toLowerCase();
    const email = (form.email || "").trim().toLowerCase();
    if (db.users.some(u => u.username === username)) throw new Error("Username taken");
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Username must be 3–24 lowercase letters, numbers, or _");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a real email");
    if (db.users.some(u => u.email.toLowerCase() === email)) throw new Error("Email already registered");
    if (!form.password || form.password.length < 6) throw new Error("Password needs 6+ characters");
    const id = "u" + Date.now();
    mutate(db => {
      db.users.push({ id, username, name: form.name || username, bio: form.bio || "", avatar: form.avatar || av("photo-1534528741775-53994a69daeb"), city: form.city || "Miami", verified: false, private: false, followers: [], following: [], email, password: form.password, birthday: form.birthday });
      db.session = id;
    });
  },
  login(email, password) {
    const u = db.users.find(x => x.email.toLowerCase() === email.toLowerCase() || x.username === email.toLowerCase());
    if (!u || !password || u.password !== password) throw new Error("Email or password is wrong");
    mutate(db => { db.session = u.id; });
  },
  oauth(provider) {
    const email = provider + "@oldtime.app";
    let u = db.users.find(x => x.email === email);
    if (!u) {
      const id = "u" + Date.now();
      u = { id, username: provider + Date.now().toString().slice(-4), name: provider[0].toUpperCase() + provider.slice(1) + " user", bio: "", avatar: av("photo-1534528741775-53994a69daeb"), city: "Miami", verified: false, private: false, followers: [], following: [], email, password: "oauth" };
      db.users.push(u);
    }
    db.session = u.id; persist();
  },
  logout() { sessionStorage.removeItem("oldtime-as"); mutate(db => { db.session = null; }); },
  blocked(a, b) { return db.blocks.some(x => (x.by === a && x.who === b) || (x.by === b && x.who === a)); },
  canSee(authorId) {
    const me = this.me();
    const author = this.user(authorId);
    if (!author) return false;
    if (me && this.blocked(me.id, author.id)) return false;
    if (author.private && author.id !== me?.id && !author.followers.includes(me?.id)) return false;
    return true;
  },
  canSeePost(post) {
    if (!post || !this.canSee(post.author)) return false;
    const me = this.me();
    const author = this.user(post.author);
    return post.visibility !== "followers" || me?.id === author.id || author.followers.includes(me?.id);
  },
  posts() {
    return db.posts.filter(p => this.canSeePost(p));
  },
  ranked(mode) {
    const me = this.me();
    let list = this.posts();
    if (mode === "following" && me) list = list.filter(p => me.following.includes(p.author) || p.author === me.id);
    return list.sort((a, b) => score(b, me) - score(a, me));
  }
};
function score(p, me) {
  const completion = p.watch || 0.35;
  const fresh = Math.max(0, 1 - (Date.now() - p.created) / 864e5);
  const interest = (p.tags || []).reduce((n, t) => n + ((me && db.interests[t]) || 0), 0);
  const small = (p.views || 0) < 3000 ? 0.35 : 0;
  return completion * 5 + (p.replays || 0) * 3 + (p.shares || 0) * 2 + p.saves.length * 2 + p.comments.length * 1.4 + p.likes.length + fresh + interest + small;
}
export function mutate(fn) {
  const before = structuredClone(db);
  try { fn(db); persist(); }
  catch (error) { db = before; throw error; }
}
export function notify(db, note) {
  if (db.users.find(u => u.id === note.user)?.notifs === false || api.blocked(note.user, note.actor)) return;
  db.notes.unshift(note);
}
export function fileToData(file) {
  if (!file || file.size > 2 * 1024 * 1024) return Promise.reject(new Error("Local demo uploads are limited to 2 MB per file."));
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ url: r.result, video: file.type.startsWith("video"), name: file.name });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
window.addEventListener("storage", e => {
  if (e.key !== KEY) return;
  db = load();
  window.dispatchEvent(new Event("oldtime-data"));
});
