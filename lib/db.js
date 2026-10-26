import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(url);

const g = globalThis;
export const sql =
  g.__sql ||
  (g.__sql = postgres(url, {
    ssl: isLocal ? false : 'require',
    max: 5,
    idle_timeout: 20,
    prepare: false,
    onnotice: () => {},
  }));

const SCHEMA = `
create table if not exists products (
  id integer primary key,
  name text not null,
  brand text,
  vendor text,
  category text,
  image_url text,
  sales_url text,
  usp text,
  wired_hurdle text,
  manager text,
  policies jsonb not null default '[]',
  price_from integer,
  wired_updated_at timestamptz,
  active boolean not null default true,
  synced_at timestamptz not null default now()
);
create index if not exists products_active_idx on products(active, wired_updated_at desc);

create table if not exists product_edits (
  product_id integer primary key,
  hurdle text,
  hidden boolean not null default false,
  policy_id integer,
  options jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists partners (
  id serial primary key,
  slug text unique not null,
  name text not null,
  our_manager text,
  manager_contact text,
  memo text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  partner_id integer not null references partners(id) on delete cascade,
  session_id text,
  type text not null,
  product_id integer,
  value integer,
  created_at timestamptz not null default now()
);
create index if not exists events_partner_idx on events(partner_id, created_at desc);
create index if not exists events_product_idx on events(product_id) where product_id is not null;

alter table products add column if not exists search_keyword text;
alter table products add column if not exists reels jsonb not null default '[]';
alter table products add column if not exists reels_keyword text;
alter table products add column if not exists reels_at timestamptz;
alter table product_edits add column if not exists reels_keyword text;
alter table product_edits add column if not exists hidden_reels jsonb;
alter table product_edits add column if not exists popular_pin boolean not null default false;

alter table product_edits add column if not exists display_name text;
alter table partners add column if not exists show_commission boolean not null default true;
alter table partners add column if not exists company_margin numeric not null default 5;

create table if not exists partner_exclusions (
  partner_id integer not null references partners(id) on delete cascade,
  product_id integer not null,
  created_at timestamptz not null default now(),
  primary key (partner_id, product_id)
);

create table if not exists proposal_requests (
  id serial primary key,
  partner_id integer not null references partners(id) on delete cascade,
  product_id integer not null,
  status text not null default 'requested',
  rates jsonb,
  note text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (partner_id, product_id)
);

create table if not exists sync_batches (
  id serial primary key,
  status text not null default 'collecting',
  active_ids jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);
create table if not exists sync_items (
  batch_id integer not null references sync_batches(id) on delete cascade,
  product_id integer not null,
  kind text not null,
  payload jsonb,
  reels jsonb,
  primary key (batch_id, product_id)
);

create table if not exists sync_log (
  id serial primary key,
  at timestamptz not null default now(),
  total integer,
  changed integer
);
`;

let ready;
export function ensureSchema() {
  if (!ready) ready = sql.unsafe(SCHEMA).then(() => true).catch((e) => { ready = null; throw e; });
  return ready;
}
