-- Old Time schema. Wire app/store.js services to these tables later.
create table profiles (
  id uuid primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar text,
  birthday date,
  is_private boolean default false,
  email text
);
create table posts (
  id uuid primary key,
  author uuid references profiles(id),
  kind text check (kind in ('video','photo','carousel','text','story')),
  caption text,
  media jsonb,
  location text,
  sound text,
  created_at timestamptz default now(),
  expires_at timestamptz
);
create table follows (follower uuid, following uuid, primary key (follower, following));
create table likes (user_id uuid, post_id uuid, primary key (user_id, post_id));
create table comments (
  id uuid primary key,
  post_id uuid,
  author uuid,
  parent uuid,
  body text,
  created_at timestamptz default now()
);
create table saves (user_id uuid, post_id uuid, primary key (user_id, post_id));
create table conversations (id uuid primary key, title text, members uuid[]);
create table messages (
  id uuid primary key,
  conversation uuid,
  author uuid,
  body text,
  media text,
  created_at timestamptz default now()
);
create table notifications (
  id uuid primary key,
  user_id uuid,
  kind text,
  actor uuid,
  post_id uuid,
  body text,
  created_at timestamptz default now()
);
create table blocks (blocker uuid, blocked uuid, primary key (blocker, blocked));
create table reports (id uuid primary key, reporter uuid, target text, reason text, created_at timestamptz default now());
