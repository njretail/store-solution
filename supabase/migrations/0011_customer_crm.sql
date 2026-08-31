-- 고객 CRM 기반: 고객 식별, 판매-고객 연결, 타겟 쿠폰 발급/자동적용
-- 0010_sale_status.sql 실행 이후, Supabase SQL Editor에서 실행하세요.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  phone text not null,
  name text,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (store_id, phone)
);

alter table public.sales add column if not exists customer_id uuid references public.customers (id);

alter table public.customers enable row level security;

create policy "customers admin all" on public.customers for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "customers staff select" on public.customers for select
  using (store_id = (select store_id from public.current_profile()));

-- 타겟 쿠폰: 특정 고객에게 발급되어 다음 결제 시 자동 적용되는 쿠폰(공용 코드형 coupons와는 별개)
create table public.customer_coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  customer_id uuid not null references public.customers (id),
  title text not null,
  discount_type text not null check (discount_type in ('amount', 'percent')),
  discount_value integer not null check (discount_value > 0),
  campaign_type text not null default 'manual'
    check (campaign_type in ('routine', 'clearance', 'deadtime', 'winback', 'welcome', 'manual')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_sale_id uuid references public.sales (id)
);

alter table public.customer_coupons enable row level security;

create policy "customer_coupons admin all" on public.customer_coupons for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "customer_coupons staff select" on public.customer_coupons for select
  using (store_id = (select store_id from public.current_profile()));

-- record_sale 재정의: 전화번호로 고객 식별/신규 생성, 신규 고객 첫 방문 500원 즉시 할인,
-- 기존 고객이면 보유한 미사용 타겟 쿠폰 중 하나를 자동 적용하고 사용 처리한다.
drop function if exists public.record_sale(text, jsonb, text, integer);

create function public.record_sale(
  p_payment_method text,
  p_items jsonb,
  p_coupon_code text default null,
  p_discount_amount integer default 0,
  p_customer_phone text default null
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
  v_customer_id uuid;
  v_is_new_customer boolean := false;
  v_customer_coupon record;
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

  if p_customer_phone is not null and length(trim(p_customer_phone)) > 0 then
    select id into v_customer_id from public.customers
      where store_id = v_store_id and phone = trim(p_customer_phone);

    if v_customer_id is null then
      insert into public.customers (store_id, phone)
      values (v_store_id, trim(p_customer_phone))
      returning id into v_customer_id;
      v_is_new_customer := true;
    end if;

    if v_is_new_customer then
      v_discount := v_discount + least(500, greatest(v_subtotal - v_discount, 0));
    else
      select * into v_customer_coupon from public.customer_coupons
        where customer_id = v_customer_id
          and redeemed_at is null
          and (expires_at is null or expires_at > now())
        order by expires_at nulls last
        limit 1;

      if v_customer_coupon.id is not null then
        if v_customer_coupon.discount_type = 'percent' then
          v_discount := v_discount + (v_subtotal * v_customer_coupon.discount_value / 100);
        else
          v_discount := v_discount + v_customer_coupon.discount_value;
        end if;
      end if;
    end if;
  end if;

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;

  insert into public.sales (store_id, total_amount, payment_method, discount_amount, customer_id, created_by)
  values (v_store_id, v_subtotal - v_discount, p_payment_method, v_discount, v_customer_id, auth.uid())
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

  if v_customer_coupon.id is not null then
    update public.customer_coupons
      set redeemed_at = now(), redeemed_sale_id = v_sale.id
      where id = v_customer_coupon.id;
  end if;

  return v_sale;
end;
$$;

grant execute on function public.record_sale(text, jsonb, text, integer, text) to authenticated;
