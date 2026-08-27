-- 무인편의점 관리자페이지 9차 확장 스키마 (상품 이미지)
-- 0001~0008 실행 이후, Supabase SQL Editor에서 실행하세요.

alter table public.products
  add column if not exists image_url text;
