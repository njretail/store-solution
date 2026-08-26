-- 무인편의점 관리자페이지 2차 확장 스키마
-- 0001_init.sql 실행 이후, Supabase SQL Editor에서 실행하세요.

-- 1) 직원 계정 관리: profiles에 email 저장 + admin 전체 접근 정책
alter table public.profiles add column if not exists email text;

create policy "profiles admin all" on public.profiles for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 2) 재고 부족 알림: 상품별 임계치
alter table public.products
  add column if not exists low_stock_threshold integer not null default 5;

-- 3) 할인/쿠폰
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('amount', 'percent')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

create policy "coupons admin all" on public.coupons for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

alter table public.sales
  add column if not exists discount_amount integer not null default 0;

-- record_sale에 쿠폰/할인 파라미터 추가 (매개변수 목록이 바뀌므로 기존 함수를 지우고 새로 생성)
drop function if exists public.record_sale(text, jsonb);

create function public.record_sale(
  p_payment_method text,
  p_items jsonb,
  p_coupon_code text default null,
  p_discount_amount integer default 0
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_store_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_coupon record;
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
    v_subtotal := v_subtotal + v_product.sell_price * v_quantity;
  end loop;

  v_discount := greatest(coalesce(p_discount_amount, 0), 0);

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
      where code = p_coupon_code and active = true;
    if v_coupon.id is null then
      raise exception '유효하지 않은 쿠폰입니다';
    end if;
    if v_coupon.discount_type = 'percent' then
      v_discount := v_discount + (v_subtotal * v_coupon.discount_value / 100);
    else
      v_discount := v_discount + v_coupon.discount_value;
    end if;
  end if;

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;

  insert into public.sales (store_id, total_amount, payment_method, discount_amount, created_by)
  values (v_store_id, v_subtotal - v_discount, p_payment_method, v_discount, auth.uid())
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

grant execute on function public.record_sale(text, jsonb, text, integer) to authenticated;
