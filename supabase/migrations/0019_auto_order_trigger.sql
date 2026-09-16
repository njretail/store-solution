-- 자동발주 실시간화: 지금까지는 Vercel Cron(app/api/cron/auto-order)이 하루 한 번씩
-- 재고를 스캔해서 발주를 만들었는데, 재고가 기준 이하로 "떨어지는 바로 그 순간"
-- 발주가 만들어지도록 트리거로 보강한다. 로직(부족분만큼 발주, 이미 진행중인 발주
-- 있으면 중복생성 안 함)은 lib/auto-order-scan.ts의 runAutoOrderScan과 동일하게 맞춘다.
-- 크론은 트리거를 놓친 경우를 대비한 안전망으로 그대로 남겨둔다.
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

  -- 직전에도 이미 "자동발주 대상" 상태였다면(재고가 더 줄었을 뿐이거나 관련 없는
  -- 컬럼이 바뀐 것) 매번 다시 조회하지 않고 넘어간다 — 실제 중복 방지는 아래
  -- 진행중인 발주 존재 여부 체크가 최종적으로 한다.
  if old.auto_order_enabled and old.stock_qty <= old.low_stock_threshold then
    return new;
  end if;

  select count(*) into v_open_count
    from public.purchase_orders
    where product_id = new.id
      and status in ('confirmed', 'preparing', 'shipping');
  if v_open_count > 0 then
    return new;
  end if;

  v_quantity := new.low_stock_threshold - new.stock_qty;
  if v_quantity <= 0 then
    return new;
  end if;

  insert into public.purchase_orders (store_id, product_id, quantity, channel, source, status)
  values (new.store_id, new.id, v_quantity, 'hq', 'auto', 'confirmed');

  return new;
end;
$$;

drop trigger if exists products_auto_order_trigger on public.products;
create trigger products_auto_order_trigger
  after update of stock_qty, auto_order_enabled, low_stock_threshold on public.products
  for each row
  execute function public.auto_order_on_low_stock();
