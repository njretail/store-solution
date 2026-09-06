-- 발주 시스템: 상품별 자동발주 설정 + 발주 기록 테이블

alter table public.products
  add column if not exists auto_order_enabled boolean not null default false,
  add column if not exists reorder_qty integer not null default 0,
  add column if not exists coupang_product_url text;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  channel text not null check (channel in ('hq', 'coupang')),
  source text not null check (source in ('auto', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'ordered', 'received', 'cancelled')),
  coupang_link text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;

-- stock_ins와 동일한 정책 형태: admin은 전체, staff는 본인 매장만 조회.
-- insert/update는 관리자 서버 액션(및 서비스 롤 크론)에서만 수행하므로 admin 전체 정책 하나로 충분하다.
create policy "purchase_orders admin all" on public.purchase_orders for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

create policy "purchase_orders staff select" on public.purchase_orders for select
  using (store_id = (select store_id from public.current_profile()));
