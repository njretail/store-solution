-- 무인편의점 관리자페이지 6차 확장 스키마 (매장별 기본 마진율 — 쿠팡 매입 등록 판매가 자동계산용)
-- 0001~0005 실행 이후, Supabase SQL Editor에서 실행하세요.

alter table public.stores
  add column if not exists default_margin_percent numeric not null default 32;
