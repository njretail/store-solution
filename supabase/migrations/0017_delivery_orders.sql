-- 배송주문건: 키오스크에서 구매자가 "배송으로 받기"를 선택하면 생길 주문을 위한 확장.
-- 아직 실제 키오스크 하드웨어 연동은 없어(kiosk_label 등과 동일) 당장은 관리자/직원이
-- 화면에서 수동으로 등록하고, 나중에 키오스크가 붙으면 app/api/kiosk/delivery-orders
-- 웹훅이 record_delivery_sale을 그대로 호출해 같은 경로로 들어오게 만들었다.

alter table public.stores
  add column if not exists default_delivery_fee integer not null default 0,
  add column if not exists free_shipping_threshold integer;

alter table public.sales
  add column if not exists is_delivery boolean not null default false,
  add column if not exists delivery_status text
    check (delivery_status in ('requested', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  add column if not exists delivery_address text,
  add column if not exists delivery_phone text,
  add column if not exists delivery_memo text,
  add column if not exists delivery_fee integer not null default 0;

create index if not exists sales_delivery_idx on public.sales (store_id, delivery_status)
  where is_delivery;

-- 배송주문 등록: sales + sale_items insert, 재고 차감까지 record_sale과 같은 방식으로
-- 원자적으로 처리하되 배송비(무료배송 기준 적용)까지 계산해 total_amount에 더한다.
-- p_items의 각 항목은 product_id 또는 barcode 중 하나로 상품을 찾는다(관리자 화면은
-- product_id를, 앞으로 붙을 키오스크 웹훅은 barcode를 쓸 걸 염두에 둠).
create function public.record_delivery_sale(
  p_store_id uuid,
  p_items jsonb,
  p_payment_method text default 'card',
  p_kiosk_label text default null,
  p_order_number text default null,
  p_approval_number text default null,
  p_payment_detail text default null,
  p_delivery_address text default null,
  p_delivery_phone text default null,
  p_delivery_memo text default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_delivery_fee integer := 0;
  v_default_fee integer;
  v_free_threshold integer;
  v_sale public.sales;
begin
  -- 관리자/직원 화면(로그인 세션)에서 호출하면 본인 매장인지 확인한다. 세션이 없는
  -- 호출(v_caller.role is null)은 서비스 롤 키 + 자체 시크릿으로 이미 인증을 마친
  -- 키오스크 웹훅으로 보고 통과시킨다 — record_sale과 달리 여기선 auth.uid()가
  -- 항상 있다고 가정할 수 없다.
  select * into v_caller from public.current_profile();
  if v_caller.role is not null and v_caller.role <> 'admin' and v_caller.store_id <> p_store_id then
    raise exception '다른 매장의 주문입니다';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '주문 항목이 없습니다';
  end if;
  if p_delivery_address is null or btrim(p_delivery_address) = '' then
    raise exception '배송지를 입력하세요';
  end if;

  select default_delivery_fee, free_shipping_threshold
    into v_default_fee, v_free_threshold
    from public.stores where id = p_store_id;
  if not found then
    raise exception '매장을 찾을 수 없습니다';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where store_id = p_store_id
        and (
          (v_item ? 'product_id' and id = (v_item ->> 'product_id')::uuid)
          or (v_item ? 'barcode' and barcode = (v_item ->> 'barcode'))
        );
    if v_product.id is null then
      raise exception '상품을 찾을 수 없습니다';
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

  v_delivery_fee := coalesce(v_default_fee, 0);
  if v_free_threshold is not null and v_subtotal >= v_free_threshold then
    v_delivery_fee := 0;
  end if;

  insert into public.sales (
    store_id, total_amount, payment_method, created_by,
    is_delivery, delivery_status, delivery_address, delivery_phone, delivery_memo, delivery_fee,
    kiosk_label, order_number, approval_number, payment_detail
  )
  values (
    p_store_id, v_subtotal + v_delivery_fee, p_payment_method, auth.uid(),
    true, 'requested', btrim(p_delivery_address), p_delivery_phone, p_delivery_memo, v_delivery_fee,
    p_kiosk_label, p_order_number, p_approval_number, p_payment_detail
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where store_id = p_store_id
        and (
          (v_item ? 'product_id' and id = (v_item ->> 'product_id')::uuid)
          or (v_item ? 'barcode' and barcode = (v_item ->> 'barcode'))
        );
    v_quantity := (v_item ->> 'quantity')::integer;

    insert into public.sale_items (sale_id, store_id, product_id, quantity, unit_price, subtotal)
    values (v_sale.id, p_store_id, v_product.id, v_quantity, v_product.sell_price, v_product.sell_price * v_quantity);

    update public.products set stock_qty = stock_qty - v_quantity, updated_at = now()
    where id = v_product.id;
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.record_delivery_sale(
  uuid, jsonb, text, text, text, text, text, text, text, text
) to authenticated;

-- 배송주문 상태 전환: sales는 (다른 컬럼들처럼) RPC를 통해서만 쓸 수 있게 설계돼 있어서
-- (직접 update 가능한 RLS 정책이 없음) delivery_status도 cancel_sale과 같은 방식의
-- SECURITY DEFINER 함수로 바꾼다. 배송요청 -> 상품준비중 -> 배송중 -> 배송완료 순서이고
-- 배송요청 단계에서만 취소할 수 있다 — 이 규칙도 여기 서버 쪽에서 최종적으로 강제한다.
create function public.set_delivery_status(p_sale_id uuid, p_status text)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_sale public.sales;
  v_current text;
  v_allowed text[];
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null or not v_sale.is_delivery then
    raise exception '배송주문을 찾을 수 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> v_sale.store_id then
    raise exception '다른 매장의 주문입니다';
  end if;

  v_current := coalesce(v_sale.delivery_status, 'requested');
  v_allowed := case v_current
    when 'requested' then array['preparing', 'cancelled']
    when 'preparing' then array['out_for_delivery']
    when 'out_for_delivery' then array['delivered']
    else array[]::text[]
  end;
  if not (p_status = any(v_allowed)) then
    raise exception '% 상태에서는 %(으)로 바꿀 수 없습니다', v_current, p_status;
  end if;

  update public.sales set delivery_status = p_status where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

grant execute on function public.set_delivery_status(uuid, text) to authenticated;
