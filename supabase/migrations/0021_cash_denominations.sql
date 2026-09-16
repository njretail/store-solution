-- 현금 권종별 관리 — 오더인 매뉴얼의 "방출금액 관리(권종별 입금·방출)"에 해당.
-- 입출금 등록 시 실제 세는 지폐/동전 매수를 선택적으로 남길 수 있게 컬럼만 추가한다
-- (금액 합계는 기존 amount 컬럼 그대로 씀 — denominations는 그 내역의 참고자료).
alter table public.cash_transactions
  add column if not exists denominations jsonb;
