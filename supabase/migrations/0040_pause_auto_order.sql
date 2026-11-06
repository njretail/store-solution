-- 자동발주 잠시 중지 — 물류창고가 확보되기 전까지 자동발주를 끈다.
-- 화면과 매일 도는 크론은 lib/features.ts의 AUTO_ORDER_ENABLED = false로 이미 멈췄지만,
-- 재고가 떨어지는 순간 발주를 만드는 DB 트리거(0019)는 앱 코드로 막을 수 없어서 여기서 끈다.
-- 트리거를 지우지 않고 "끄기"만 하므로, 상품별 자동발주 설정(auto_order_enabled)은 그대로 남는다.
-- 0019를 실행하지 않은 DB(트리거가 없는 경우)에서도 오류 없이 지나가도록 존재 여부를 먼저 확인한다.
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'products_auto_order_trigger'
  ) then
    alter table public.products disable trigger products_auto_order_trigger;
  end if;
end;
$$;

-- 다시 켤 때(물류창고 확보 후): lib/features.ts에서 AUTO_ORDER_ENABLED = true로 바꾸고,
-- 트리거가 있으면 아래 한 줄 실행(없으면 0019를 실행해서 만든다).
-- alter table public.products enable trigger products_auto_order_trigger;
