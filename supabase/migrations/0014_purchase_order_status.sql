-- 발주 상태를 실제 쇼핑몰 유통 흐름처럼 세분화한다.
-- pending/ordered(발주 요청됨) -> confirmed(발주완료)
-- received(입고완료) -> delivered(배송완료)
-- 그 사이에 preparing(상품준비중), shipping(배송중) 단계를 추가한다.
alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;

update public.purchase_orders set status = 'confirmed' where status in ('pending', 'ordered');
update public.purchase_orders set status = 'delivered' where status = 'received';

alter table public.purchase_orders
  alter column status set default 'confirmed';

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in ('confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'));
