-- 키오스크 쿠폰 연동 — 셀프 계산대 디자인(docs/design/self-checkout.html)의 적립·쿠폰 흐름을
-- 실제 데이터와 연결하기 위한 DB 준비.
--
-- 1) record_sale: 손님이 "쓸 쿠폰"을 고르거나 "쿠폰 안 쓰고 적립만"을 고를 수 있게 매개변수 2개 추가.
--    두 값을 안 넘기면 지금과 똑같이 동작한다(만료가 가장 빠른 쿠폰 1장 자동 적용) — 판매 화면은 그대로.
--    매개변수 목록이 바뀌면 같은 이름의 함수가 두 개 생겨 호출이 모호해지므로 기존 정의를 먼저 지운다.
-- 2) attach_customer_to_sale: 번호 입력을 건너뛰고 결제한 손님이 완료 화면에서 번호를 넣으면
--    방금 끝난 판매에 고객을 붙인다(할인 없이 적립만). 키오스크 서버(서비스 롤)만 부를 수 있다.

drop function if exists public.record_sale(text, jsonb, text, integer, text);

create or replace function public.record_sale(
  p_payment_method text,
  p_items jsonb,
  p_coupon_code text default null,
  p_discount_amount integer default 0,
  p_customer_phone text default null,
  -- 손님이 고른 쿠폰(customer_coupons.id). null이면 만료가 가장 빠른 쿠폰을 자동으로 쓴다.
  p_customer_coupon_id uuid default null,
  -- false면 쿠폰을 쓰지 않고 적립만 한다("쿠폰 안 쓰고 적립만").
  p_use_customer_coupon boolean default true
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
    elsif coalesce(p_use_customer_coupon, true) then
      if p_customer_coupon_id is not null then
        -- 손님이 고른 쿠폰: 이 고객의 쿠폰이고 아직 안 썼고 만료 전이어야 한다
        select * into v_customer_coupon from public.customer_coupons
          where id = p_customer_coupon_id
            and customer_id = v_customer_id
            and redeemed_at is null
            and (expires_at is null or expires_at > now());
        if v_customer_coupon.id is null then
          raise exception '사용할 수 없는 쿠폰입니다';
        end if;
      else
        select * into v_customer_coupon from public.customer_coupons
          where customer_id = v_customer_id
            and redeemed_at is null
            and (expires_at is null or expires_at > now())
          order by expires_at nulls last
          limit 1;
      end if;

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

grant execute on function public.record_sale(text, jsonb, text, integer, text, uuid, boolean) to authenticated;

-- 결제 후 적립: 방금 끝난 판매(고객 없음, 30분 이내)에 번호로 고객을 붙인다. 할인은 없다.
-- 처음 온 번호면 고객을 새로 만든다. 첫 구매 500원 할인은 결제가 끝나서 적용하지 않는다.
create or replace function public.attach_customer_to_sale(
  p_store_id uuid,
  p_sale_id uuid,
  p_customer_phone text
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_customer_id uuid;
begin
  if length(v_phone) = 0 then
    raise exception '전화번호가 필요합니다';
  end if;

  select * into v_sale from public.sales
    where id = p_sale_id and store_id = p_store_id
    for update;
  if v_sale.id is null then
    raise exception '판매 기록을 찾을 수 없습니다';
  end if;
  if v_sale.customer_id is not null then
    raise exception '이미 적립된 결제입니다';
  end if;
  if v_sale.created_at < now() - interval '30 minutes' then
    raise exception '결제 후 30분이 지나 적립할 수 없습니다';
  end if;

  select id into v_customer_id from public.customers
    where store_id = p_store_id and phone = v_phone;
  if v_customer_id is null then
    insert into public.customers (store_id, phone)
    values (p_store_id, v_phone)
    returning id into v_customer_id;
  end if;

  update public.sales set customer_id = v_customer_id
    where id = v_sale.id
    returning * into v_sale;
  return v_sale;
end;
$$;

-- 로그인 없이 쓰는 함수라 일반 사용자에게는 열지 않는다(키오스크 API가 서비스 롤로만 부름).
revoke all on function public.attach_customer_to_sale(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.attach_customer_to_sale(uuid, uuid, text) to service_role;
