-- THE HUB STAGE 2: the workspace tables and the private file store.
-- Thulaib's GO: bb_pending 708, 24 Oct 2026 ("GET IT DONE"), on mould/stage2/PLAN.md. Additive only: no existing table changes.
-- Rollback: 2026-10-24-hub-stage2-workspace.ROLLBACK.sql beside this file.
--
-- THE WALL, INSIDE THE DATABASE. Every row carries its client. Every table has unique (client, id) and every link between
-- tables is a composite foreign key (client, x_id), so a row can never point at another client's row even if the code is
-- wrong. Links held in arrays (photos, task files) and the one link that can point at two tables (a message's ref) are
-- checked by os_work_guard(). RLS is on with NO policies and every right is taken from anon and authenticated (this
-- database's default hands new tables to anon), so only the server's service key reaches these tables.

create table public.os_people (
  id uuid primary key default gen_random_uuid(),
  client text not null references public.os_clients(slug) on update cascade,
  side text not null check (side in ('client', 'bb')),
  name text not null check (char_length(name) between 1 and 60),
  role text not null default '' check (char_length(role) <= 60),
  code_salt text not null,
  code_hash text not null,
  revoked_at timestamptz,
  last_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client, id)
);
create unique index os_people_one_name on public.os_people (client, lower(name)) where revoked_at is null;

create table public.os_door_tries (
  id bigint generated always as identity primary key,
  business text not null check (char_length(business) <= 90),
  caller text not null check (char_length(caller) <= 64),
  at timestamptz not null default now()
);
create index os_door_tries_business on public.os_door_tries (business, caller, at desc);
create index os_door_tries_caller on public.os_door_tries (caller, at desc);

create table public.os_files (
  id uuid primary key default gen_random_uuid(),
  client text not null references public.os_clients(slug) on update cascade,
  path text not null unique,
  kind text not null check (kind in ('photo', 'voice', 'art')),
  mime text not null check (mime in ('image/jpeg', 'image/webp', 'image/png', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg')),
  bytes integer not null check (bytes > 0 and bytes <= case kind when 'photo' then 2097152 when 'voice' then 4194304 else 5242880 end),
  secs numeric(6,1) check (secs is null or (secs > 0 and secs <= 180)),
  by_person uuid,
  by_name text not null default '',
  created_at timestamptz not null default now(),
  unique (client, id),
  foreign key (client, by_person) references public.os_people (client, id)
);
create index os_files_client on public.os_files (client, created_at desc, id desc);

create table public.os_messages (
  id uuid primary key default gen_random_uuid(),
  client text not null references public.os_clients(slug) on update cascade,
  person_id uuid,
  by_name text not null check (char_length(by_name) between 1 and 60),
  side text not null check (side in ('client', 'bb')),
  role text not null default '' check (char_length(role) <= 60),
  text text check (text is null or char_length(text) <= 4000),
  photos uuid[] not null default '{}' check (cardinality(photos) <= 10),
  voice_file uuid,
  voice_secs numeric(6,1),
  reply_to uuid,
  ref_kind text check (ref_kind in ('task', 'post')),
  ref_id uuid,
  event text check (event in ('task-made', 'task-accepted', 'task-outside', 'task-late', 'task-done', 'approved', 'change', 'comment')),
  seen_at timestamptz,
  at timestamptz not null default now(),
  unique (client, id),
  check ((ref_kind is null) = (ref_id is null)),
  check (text is not null or cardinality(photos) > 0 or voice_file is not null or event is not null),
  foreign key (client, person_id) references public.os_people (client, id),
  foreign key (client, reply_to) references public.os_messages (client, id),
  foreign key (client, voice_file) references public.os_files (client, id)
);
create index os_messages_client on public.os_messages (client, at desc, id desc);

create table public.os_work_tasks (
  id uuid primary key default gen_random_uuid(),
  client text not null references public.os_clients(slug) on update cascade,
  title text not null check (char_length(title) between 1 and 200),
  for_side text not null check (for_side in ('client', 'bb')),
  who text check (who is null or char_length(who) <= 60),
  due date,
  stage text not null default 'todo' check (stage in ('todo', 'doing', 'done')),
  files uuid[] not null default '{}' check (cardinality(files) <= 10),
  source_msg uuid,
  asked boolean not null default false,
  outside text check (outside is null or char_length(outside) <= 300),
  late_reason text check (late_reason is null or char_length(late_reason) <= 300),
  late_due date,
  made_by uuid,
  by_name text not null default '',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client, id),
  check ((late_reason is null) = (late_due is null)),
  foreign key (client, source_msg) references public.os_messages (client, id),
  foreign key (client, made_by) references public.os_people (client, id)
);
create index os_work_tasks_client on public.os_work_tasks (client, updated_at desc, id desc);

create table public.os_posts (
  id uuid primary key default gen_random_uuid(),
  client text not null references public.os_clients(slug) on update cascade,
  platform text not null check (platform in ('Instagram', 'Facebook', 'TikTok')),
  kind text not null check (kind in ('Post', 'Carousel', 'Reel')),
  slot timestamptz not null,
  decide_by timestamptz,
  status text not null default 'waiting' check (status in ('waiting', 'planned', 'approved', 'live')),
  made_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client, id),
  foreign key (client, made_by) references public.os_people (client, id)
);
create index os_posts_client on public.os_posts (client, slot desc, id desc);

create table public.os_post_versions (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  post_id uuid not null,
  v integer not null check (v >= 1),
  caption text not null check (char_length(caption) <= 2200),
  head text not null default '' check (char_length(head) <= 120),
  line text check (line is null or char_length(line) <= 200),
  tone text not null default 'brand' check (tone in ('brand', 'ink', 'cream')),
  art_file uuid,
  made_by uuid,
  at timestamptz not null default now(),
  unique (client, id),
  unique (post_id, v),
  foreign key (client, post_id) references public.os_posts (client, id),
  foreign key (client, art_file) references public.os_files (client, id),
  foreign key (client, made_by) references public.os_people (client, id)
);

create table public.os_approvals (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  post_id uuid not null,
  v integer not null,
  answer text not null check (answer in ('approved', 'change')),
  person_id uuid not null,
  by_name text not null check (char_length(by_name) between 1 and 60),
  role text not null default '',
  text text check (text is null or char_length(text) <= 2000),
  voice_file uuid,
  voice_secs numeric(6,1),
  at timestamptz not null default now(),
  unique (client, id),
  check (answer = 'approved' or text is not null or voice_file is not null),
  foreign key (client, post_id) references public.os_posts (client, id),
  foreign key (post_id, v) references public.os_post_versions (post_id, v),
  foreign key (client, person_id) references public.os_people (client, id),
  foreign key (client, voice_file) references public.os_files (client, id)
);
create index os_approvals_post on public.os_approvals (client, post_id, at);

-- An approval is a record of what a named person said about one version. It is never edited and never deleted.
create function public.os_approvals_frozen() returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'an approval is never edited or deleted (os_approvals)';
end $$;
create trigger os_approvals_frozen before update or delete on public.os_approvals
  for each row execute function public.os_approvals_frozen();

-- The links a foreign key cannot hold: files in an array and a ref that points at a task or a post.
create function public.os_work_guard() returns trigger language plpgsql set search_path = public as $$
declare ids uuid[]; n int;
begin
  -- nested ifs on purpose: a record field the table does not have must never be read
  if tg_table_name = 'os_messages' then ids := new.photos; else ids := new.files; end if;
  if cardinality(ids) > 0 then
    select count(*) into n from public.os_files f where f.client = new.client and f.id = any(ids);
    if n <> cardinality(ids) then raise exception 'a file belongs to another client or does not exist'; end if;
  end if;
  if tg_table_name = 'os_messages' then
    if new.ref_kind = 'task' then
      if not exists (select 1 from public.os_work_tasks t where t.client = new.client and t.id = new.ref_id) then
        raise exception 'a message points at a task of another client or one that does not exist'; end if;
    elsif new.ref_kind = 'post' then
      if not exists (select 1 from public.os_posts p where p.client = new.client and p.id = new.ref_id) then
        raise exception 'a message points at a post of another client or one that does not exist'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger os_messages_guard before insert or update on public.os_messages for each row execute function public.os_work_guard();
create trigger os_work_tasks_guard before insert or update on public.os_work_tasks for each row execute function public.os_work_guard();

-- Only the server's service key. RLS on, no policies, every right taken from the public key and signed in users.
alter table public.os_people enable row level security;
alter table public.os_door_tries enable row level security;
alter table public.os_files enable row level security;
alter table public.os_messages enable row level security;
alter table public.os_work_tasks enable row level security;
alter table public.os_posts enable row level security;
alter table public.os_post_versions enable row level security;
alter table public.os_approvals enable row level security;
revoke all on public.os_people, public.os_door_tries, public.os_files, public.os_messages, public.os_work_tasks,
  public.os_posts, public.os_post_versions, public.os_approvals from anon, authenticated, public;
revoke all on function public.os_approvals_frozen(), public.os_work_guard() from anon, authenticated, public;

-- THE FILE STORE: private, no storage policies, so nothing opens without a link the server signs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-media', 'hub-media', false, 5242880,
  array['image/jpeg', 'image/webp', 'image/png', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg']);
