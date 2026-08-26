-- 무인편의점 관리자페이지 4차 확장 스키마 (소비기한 등록)
-- 0001, 0002, 0003 실행 이후, Supabase SQL Editor에서 실행하세요.

create table public.product_expiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  expiry_date date not null,
  quantity integer not null check (quantity > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.product_expiries enable row level security;

create policy "product_expiries admin all" on public.product_expiries for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

create policy "product_expiries staff select" on public.product_expiries for select
  using (store_id = (select store_id from public.current_profile()));

create policy "product_expiries staff insert" on public.product_expiries for insert
  with check (store_id = (select store_id from public.current_profile()));
