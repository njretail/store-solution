-- 공급가/판매가 통제수준(①본사고정)은 "본사가 등록한 상품"에만 의미가 있다.
-- 점포가 직접 만든 상품(상품 추가, 대량매입 신규등록)은 본사가 가격을 정해준 적이
-- 없으니 그 상품만큼은 정책과 무관하게 점포가 계속 수정할 수 있어야 한다.
-- 기존 상품(이 컬럼이 생기기 전 데이터, 과거 카탈로그 일괄이전 포함)은 전부 'store'로
-- 두어 지금 당장 아무것도 더 잠그지 않는다 — 앞으로 "상품 일괄 등록"(본사 채널)으로
-- 등록/갱신하는 상품만 'hq'로 표시된다.
alter table public.products
  add column if not exists origin text not null default 'store'
    check (origin in ('hq', 'store'));
