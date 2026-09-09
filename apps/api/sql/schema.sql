-- BB Client OS tables. NOT applied by any code. Thulaib approves schema changes.
-- Every row carries the client slug; the API only ever reads its own slug.
create table if not exists os_enquiries (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  name text not null,
  phone text,
  email text,
  source text,           -- whatsapp | walk_in | instagram | facebook | website | referral | phone
  wants text,
  status text not null default 'new',   -- new | contacted | converted | closed
  deal_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists os_deals (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  name text not null,
  phone text,
  wants text,
  stage text not null default 'talking',  -- talking | quoted | closing | won | lost
  value numeric default 0,
  next_step text,
  next_at date,
  enquiry_id uuid,
  customer_id uuid,
  lost_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists os_customers (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  name text not null,
  phone text,
  email text,
  bought text,
  value numeric default 0,
  since date default current_date,
  deal_id uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists os_tasks (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  text text not null,
  due date,
  done boolean default false,
  deal_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists os_activities (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  deal_id uuid,
  type text,     -- call | message | meeting | note | quote
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists os_enquiries_client on os_enquiries(client);
create index if not exists os_deals_client on os_deals(client);
create index if not exists os_customers_client on os_customers(client);
create index if not exists os_tasks_client on os_tasks(client);
create index if not exists os_activities_client on os_activities(client);
