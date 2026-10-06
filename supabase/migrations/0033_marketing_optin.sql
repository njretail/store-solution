-- 결제 완료 후 "마케팅 소식 받아보기" 동의 — 기술 인수인계서 9번에서 확인 필요로
-- 남겨뒀던 "전화번호 수집·이용 동의 절차 없음" 문제를 실제로 메운다. 수집 항목(전화번호)·
-- 목적(마케팅 소식 안내)·동의 여부와 시각을 customers에 남겨서, 그냥 결제 중 식별을 위해
-- 받은 번호(동의 안 한 번호)와 구분한다.
alter table public.customers
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

-- 동의한 고객에게 감사 쿠폰을 자동 발급하기 위해 campaign_type에 값을 하나 추가한다.
alter table public.customer_coupons drop constraint if exists customer_coupons_campaign_type_check;
alter table public.customer_coupons add constraint customer_coupons_campaign_type_check
  check (campaign_type in ('routine', 'clearance', 'deadtime', 'winback', 'welcome', 'manual', 'marketing_optin'));
