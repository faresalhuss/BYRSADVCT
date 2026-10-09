-- BYRSADVCT initial schema. Every table has RLS. Access requires an authenticated
-- user whose email is on the allowlist. All allowed users share all data.

create table if not exists public.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
     and exists (
       select 1 from public.allowed_emails a
       where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     );
$$;

revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated, anon;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Deals -----------------------------------------------------------------------

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  dealership_name text not null,
  dealership_address text,
  dealership_phone text,
  dealership_website text,
  salesperson text,
  status text not null default 'verbal' check (status in ('verbal', 'written', 'expired')),
  quote_expires_on date,
  vehicle jsonb not null default '{}'::jsonb,
  decoded jsonb,
  sticker jsonb not null default '{"lines": [], "totalSrpCents": null}'::jsonb,
  archived_at timestamptz
);
create index if not exists deals_updated_at_idx on public.deals (updated_at desc);
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();

create table if not exists public.deal_revisions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  revision_no integer not null,
  offer jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (deal_id, revision_no)
);
create index if not exists deal_revisions_deal_idx on public.deal_revisions (deal_id, revision_no desc);

create table if not exists public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  who text,
  channel text not null default 'verbal' check (channel in ('verbal', 'written')),
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index if not exists deal_notes_deal_idx on public.deal_notes (deal_id, occurred_at desc);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind text not null default 'other' check (kind in ('sticker', 'worksheet', 'buyers_order', 'photo', 'other')),
  storage_path text not null unique,
  thumb_path text,
  mime text not null,
  bytes bigint not null,
  width integer,
  height integer,
  original_name text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index if not exists attachments_deal_idx on public.attachments (deal_id, created_at desc);

-- Trade -----------------------------------------------------------------------

create table if not exists public.trade_profile (
  id integer primary key default 1 check (id = 1),
  payload jsonb not null default '{"payoffCents": null, "payoffGoodThrough": null, "vinAndOwnerRecorded": true, "vehicle": {}}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger trade_profile_set_updated_at before update on public.trade_profile for each row execute function public.set_updated_at();
insert into public.trade_profile (id) values (1) on conflict do nothing;

create table if not exists public.outside_offers (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  cents bigint not null,
  expires_on date,
  contingent_on_inspection boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- Benchmarks, settings, tax rules ----------------------------------------------

create table if not exists public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text,
  observed_on date not null,
  total_srp_cents bigint,
  price_cents bigint not null,
  kind text not null check (kind in ('paid', 'advertised')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_set_updated_at before update on public.settings for each row execute function public.set_updated_at();

create table if not exists public.tax_rules (
  id text primary key,
  payload jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Drafts (server copy of unsaved local drafts) ---------------------------------

create table if not exists public.drafts (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger drafts_set_updated_at before update on public.drafts for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['allowed_emails', 'deals', 'deal_revisions', 'deal_notes', 'attachments', 'trade_profile', 'outside_offers', 'benchmarks', 'settings', 'tax_rules', 'drafts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_allowed_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_allowed()) with check (public.is_allowed())', t || '_allowed_all', t);
  end loop;
end
$$;

-- The allowlist itself is readable but only changed by migration.
drop policy if exists allowed_emails_allowed_all on public.allowed_emails;
create policy allowed_emails_read on public.allowed_emails for select to authenticated using (public.is_allowed());

-- Storage ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists attachments_allowed_select on storage.objects;
drop policy if exists attachments_allowed_insert on storage.objects;
drop policy if exists attachments_allowed_update on storage.objects;
drop policy if exists attachments_allowed_delete on storage.objects;
create policy attachments_allowed_select on storage.objects for select to authenticated using (bucket_id = 'attachments' and public.is_allowed());
create policy attachments_allowed_insert on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and public.is_allowed());
create policy attachments_allowed_update on storage.objects for update to authenticated using (bucket_id = 'attachments' and public.is_allowed()) with check (bucket_id = 'attachments' and public.is_allowed());
create policy attachments_allowed_delete on storage.objects for delete to authenticated using (bucket_id = 'attachments' and public.is_allowed());
