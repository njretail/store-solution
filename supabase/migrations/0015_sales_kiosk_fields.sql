-- 판매내역 상세에 키오스크(PG단말기) 결제정보(키오스크명, 주문번호, 승인번호, 카드사 등)를
-- 표시하기 위한 컬럼 추가. 이 저장소에는 sales insert 코드가 없음 — 실제 값은 앞으로
-- 키오스크 연동이 붙을 때 그쪽에서 채워 넣는다. 기존 행은 모두 null로 남고 화면에서는
-- "-"로 표시한다.
alter table public.sales
  add column if not exists kiosk_label text,
  add column if not exists order_number text,
  add column if not exists approval_number text,
  add column if not exists payment_detail text;
