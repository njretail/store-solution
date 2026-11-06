// 기능 켜기/끄기 스위치. 코드는 그대로 두고 화면·예약 작업에서만 숨긴다.

// 자동발주: 물류창고가 확보되기 전까지 숨김. 다시 켜려면 true로 바꾸고,
// DB 트리거도 다시 켜야 한다(supabase/migrations/0040_pause_auto_order.sql 안내 참고).
export const AUTO_ORDER_ENABLED = false;
