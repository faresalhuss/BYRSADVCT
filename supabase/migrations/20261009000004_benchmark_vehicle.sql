alter table public.benchmarks add column if not exists vehicle text not null default 'purchase' check (vehicle in ('purchase', 'trade'));
