-- 무인편의점 관리자페이지 초기 스키마
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'staff');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'staff',
  store_id uuid references public.stores (id),
  name text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  barcode text not null,
  name text not null,
  category text,
  cost_price integer not null default 0,
  sell_price integer not null default 0,
  stock_qty integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, barcode)
);

create table public.stock_ins (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_cost integer,
  memo text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  total_amount integer not null,
  payment_method text not null default 'cash',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null,
  subtotal integer not null
);

-- 재귀 없이 role/store_id를 조회하기 위한 헬퍼 (RLS 정책에서 사용)
create function public.current_profile()
returns table (role public.user_role, store_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select role, store_id from public.profiles where id = auth.uid();
$$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_ins enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- stores
create policy "stores admin all" on public.stores for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "stores staff own" on public.stores for select
  using (id = (select store_id from public.current_profile()));
create policy "stores admin insert" on public.stores for insert
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

-- profiles (본인 것만 조회 가능하면 충분 — role/store_id 확인용)
create policy "profiles self" on public.profiles for select
  using (id = auth.uid());

-- products: admin 전체, staff는 조회만(본인 매장)
create policy "products admin all" on public.products for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "products staff select" on public.products for select
  using (store_id = (select store_id from public.current_profile()));

-- stock_ins / sales / sale_items: SELECT만 허용, INSERT는 RPC(SECURITY DEFINER)로만
create policy "stock_ins admin select" on public.stock_ins for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "stock_ins staff select" on public.stock_ins for select
  using (store_id = (select store_id from public.current_profile()));

create policy "sales admin select" on public.sales for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "sales staff select" on public.sales for select
  using (store_id = (select store_id from public.current_profile()));

create policy "sale_items admin select" on public.sale_items for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "sale_items staff select" on public.sale_items for select
  using (store_id = (select store_id from public.current_profile()));

-- 입고 기록: 재고 증가까지 원자적으로 처리
create function public.record_stock_in(
  p_product_id uuid,
  p_quantity integer,
  p_unit_cost integer default null,
  p_memo text default null
)
returns public.stock_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.current_profile%rowtype;
  v_store_id uuid;
  v_row public.stock_ins;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;

  select store_id into v_store_id from public.products where id = p_product_id;
  if v_store_id is null then
    raise exception '상품을 찾을 수 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> v_store_id then
    raise exception '다른 매장의 상품입니다';
  end if;
  if p_quantity <= 0 then
    raise exception '수량은 1 이상이어야 합니다';
  end if;

  insert into public.stock_ins (store_id, product_id, quantity, unit_cost, memo, created_by)
  values (v_store_id, p_product_id, p_quantity, p_unit_cost, p_memo, auth.uid())
  returning * into v_row;

  update public.products set stock_qty = stock_qty + p_quantity, updated_at = now()
  where id = p_product_id;

  return v_row;
end;
$$;

grant execute on function public.record_stock_in(uuid, integer, integer, text) to authenticated;

-- 판매 기록: sales + sale_items insert, 재고 차감까지 원자적으로 처리
-- p_items 형식: [{ "product_id": "...", "quantity": 2 }, ...]
create function public.record_sale(
  p_payment_method text,
  p_items jsonb
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.current_profile%rowtype;
  v_store_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_total integer := 0;
  v_sale public.sales;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;
  if v_caller.store_id is null and v_caller.role <> 'admin' then
    raise exception '소속 매장이 없습니다';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception '판매 항목이 없습니다';
  end if;

  -- 모든 항목이 같은 매장 소속인지 확인하며 합계 계산
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception '상품을 찾을 수 없습니다';
    end if;
    if v_store_id is null then
      v_store_id := v_product.store_id;
    elsif v_store_id <> v_product.store_id then
      raise exception '한 번에 한 매장의 상품만 판매할 수 있습니다';
    end if;
    if v_caller.role <> 'admin' and v_caller.store_id <> v_product.store_id then
      raise exception '다른 매장의 상품입니다';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception '수량은 1 이상이어야 합니다';
    end if;
    if v_product.stock_qty < v_quantity then
      raise exception '% 재고가 부족합니다', v_product.name;
    end if;
    v_total := v_total + v_product.sell_price * v_quantity;
  end loop;

  insert into public.sales (store_id, total_amount, payment_method, created_by)
  values (v_store_id, v_total, p_payment_method, auth.uid())
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    insert into public.sale_items (sale_id, store_id, product_id, quantity, unit_price, subtotal)
    values (v_sale.id, v_store_id, v_product.id, v_quantity, v_product.sell_price, v_product.sell_price * v_quantity);

    update public.products set stock_qty = stock_qty - v_quantity, updated_at = now()
    where id = v_product.id;
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.record_sale(text, jsonb) to authenticated;
