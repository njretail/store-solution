-- 판매 시점의 원가 스냅샷 — 지금까지는 판매 마진을 계산하려면 products.cost_price(현재
-- 원가)를 참조할 수밖에 없어서, 본사가 공급가를 바꾸면 "과거에 이미 끝난 판매"의 마진까지
-- 소급해서 달라지는 문제가 있었다(2-1 "공급가 변경 적용 시점" 항목). sale_items에 판매
-- 당시 원가를 그대로 남겨서, 이후 공급가가 몇 번을 바뀌어도 이미 끝난 판매의 마진은
-- 그 순간 그대로 고정된다.
alter table public.sale_items add column if not exists unit_cost integer not null default 0;

-- 이 컬럼이 생기기 전 판매 건은 당시 원가를 알 수 없다 — 0으로 두면 마진이 100%로
-- 보여서 더 틀리므로, 지금 원가로 근사치를 채워둔다(완벽하진 않지만 0보다 낫다).
update public.sale_items si
set unit_cost = p.cost_price
from public.products p
where si.product_id = p.id and si.unit_cost = 0;

-- record_sale 재정의: 0024_promotions.sql과 로직은 동일하고, sale_items insert에
-- unit_cost(그 순간의 products.cost_price)만 추가한다.
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

    insert into public.sale_items (sale_id, store_id, product_id, quantity, unit_price, subtotal, unit_cost)
    values (v_sale.id, v_store_id, v_product.id, v_quantity, v_unit_price, v_unit_price * v_quantity, v_product.cost_price);

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
