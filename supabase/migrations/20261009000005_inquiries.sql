create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'to_call' check (status in ('to_call', 'called', 'converted', 'dismissed')),
  dealership_name text not null,
  address_line text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  listing_url text,
  salesperson text,
  vehicle jsonb not null default '{}'::jsonb,
  advertised_price_cents bigint,
  msrp_cents bigint,
  notes text,
  converted_deal_id uuid references public.deals (id) on delete set null
);
create index if not exists inquiries_updated_idx on public.inquiries (updated_at desc);
create trigger inquiries_set_updated_at before update on public.inquiries for each row execute function public.set_updated_at();
alter table public.inquiries enable row level security;
alter table public.inquiries force row level security;
drop policy if exists inquiries_allowed_all on public.inquiries;
create policy inquiries_allowed_all on public.inquiries for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

alter table public.attachments alter column deal_id drop not null;
alter table public.attachments add column if not exists inquiry_id uuid references public.inquiries (id) on delete cascade;
alter table public.attachments drop constraint if exists attachments_owner_check;
alter table public.attachments add constraint attachments_owner_check check (deal_id is not null or inquiry_id is not null);
create index if not exists attachments_inquiry_idx on public.attachments (inquiry_id, created_at desc);
