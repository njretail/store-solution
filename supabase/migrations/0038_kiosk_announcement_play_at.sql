-- 안내멘트 재생 시점 — 대기 화면에서 반복할 멘트(광고·다모아 홍보 등)와 결제 단계마다
-- 한 번 읽을 멘트(결제 방법 선택, 카드/현금 결제, 결제 완료, 배송 완료 등)를 구분한다.
-- 기존 멘트는 모두 대기 화면 반복(idle)으로 둔다. 결제 단계 멘트는 셀프 계산대 화면에서 쓴다.
alter table public.kiosk_announcements
  add column if not exists play_at text not null default 'idle'
    check (play_at in ('idle', 'receive', 'phone', 'method', 'card', 'easy', 'cash', 'done', 'delivery_done'));

create index if not exists kiosk_announcements_play_at_idx
  on public.kiosk_announcements (store_id, play_at, sort_order);
