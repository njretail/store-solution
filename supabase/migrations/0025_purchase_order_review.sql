-- 발주 프로세스에 "상품 검토"(본사 승인/반려 + 수량조정)와 "입고 검수"(예정 수량과
-- 실제 수령 수량 비교, 오차 발생 시 실제 수량만 반영) 2단계를 추가한다.
-- 흐름: 검토대기(requested) -> 발주완료(confirmed) -> 상품준비중 -> 배송중
--       -> 배송완료(delivered, 본부 채널은 이 시점에 입고 검수 수량으로 재고 반영)
-- 검토대기 단계에서 반려하면 rejected로 끝난다. 자동발주/수동발주/쿠팡발주 모두
-- 똑같이 검토대기에서 시작한다(기술 인수인계서 2번 참고).

alter table public.purchase_orders
  add column if not exists approved_quantity integer,
  add column if not exists received_quantity integer,
  add column if not exists review_memo text,
  add column if not exists reviewed_by uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists receiving_memo text,
  add column if not exists received_by uuid references public.profiles (id),
  add column if not exists received_at timestamptz;

alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in ('requested', 'confirmed', 'preparing', 'shipping', 'delivered', 'rejected', 'cancelled'));

alter table public.purchase_orders alter column status set default 'requested';

-- 자동발주 실시간 트리거도 검토대기 상태로 만들게 바꾸고, 진행중 판단(중복 생성 방지)
-- 범위에 requested도 포함시킨다.
create or replace function public.auto_order_on_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_count integer;
  v_quantity integer;
begin
  if not new.auto_order_enabled or new.stock_qty > new.low_stock_threshold then
    return new;
  end if;

  if old.auto_order_enabled and old.stock_qty <= old.low_stock_threshold then
    return new;
  end if;

  select count(*) into v_open_count
    from public.purchase_orders
    where product_id = new.id
      and status in ('requested', 'confirmed', 'preparing', 'shipping');
  if v_open_count > 0 then
    return new;
  end if;

  v_quantity := new.low_stock_threshold - new.stock_qty;
  if v_quantity <= 0 then
    return new;
  end if;

  insert into public.purchase_orders (store_id, product_id, quantity, channel, source, status)
  values (new.store_id, new.id, v_quantity, 'hq', 'auto', 'requested');

  return new;
end;
$$;
