-- 기간한정 할인(프로모션) — 오더인 매뉴얼의 "할인 관리(금액 할인/비율 할인/기간 설정)"에
-- 해당. 지금까지 쿠폰관리는 결제 화면에서 코드를 직접 입력해야 적용되는 방식뿐이었고,
-- 기간을 정해두면 자동으로 적용되는 할인이 없었다. N+N/묶음할인은 장바구니 조합 로직이
-- 꽤 복잡해서 이번엔 금액/비율 할인 + 기간설정까지만 우선 구현한다.
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  discount_type text not null check (discount_type in ('amount', 'percent')),
  discount_value integer not null check (discount_value > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.promotions enable row level security;

create policy "promotions admin all" on public.promotions for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "promotions staff select" on public.promotions for select
  using (store_id = (select store_id from public.current_profile()));

-- record_sale 재정의: 상품별로 지금 시각에 걸쳐있는 활성 프로모션이 있으면
-- 판매가에서 자동으로 할인을 적용한다. 나머지 로직(쿠폰코드/신규고객 500원/
-- 타겟쿠폰)은 0011_customer_crm.sql과 완전히 동일하고, 상품별 단가 계산
-- 부분만 프로모션을 반영하도록 바뀌었다.
create or replace function public.record_sale(
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
  v_promo record;
  v_unit_price integer;
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

    select * into v_promo from public.promotions
      where product_id = v_product.id and active = true
        and now() >= starts_at and now() < ends_at
      order by created_at desc limit 1;
    if v_promo.id is not null then
      v_unit_price := case v_promo.discount_type
        when 'percent' then greatest(v_product.sell_price - (v_product.sell_price * v_promo.discount_value / 100), 0)
        else greatest(v_product.sell_price - v_promo.discount_value, 0)
      end;
    else
      v_unit_price := v_product.sell_price;
    end if;

    v_subtotal := v_subtotal + v_unit_price * v_quantity;
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

    select * into v_promo from public.promotions
      where product_id = v_product.id and active = true
        and now() >= starts_at and now() < ends_at
      order by created_at desc limit 1;
    if v_promo.id is not null then
      v_unit_price := case v_promo.discount_type
        when 'percent' then greatest(v_product.sell_price - (v_product.sell_price * v_promo.discount_value / 100), 0)
        else greatest(v_product.sell_price - v_promo.discount_value, 0)
      end;
    else
      v_unit_price := v_product.sell_price;
    end if;

    insert into public.sale_items (sale_id, store_id, product_id, quantity, unit_price, subtotal)
    values (v_sale.id, v_store_id, v_product.id, v_quantity, v_unit_price, v_unit_price * v_quantity);

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
