-- 무인편의점 관리자페이지 3차 확장 스키마 (상품 카테고리 + 면과세 여부)
-- 0001, 0002 실행 이후, Supabase SQL Editor에서 실행하세요.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories admin all" on public.categories for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

alter table public.products
  add column if not exists category_id uuid references public.categories (id);

alter table public.products
  add column if not exists is_tax_exempt boolean not null default false;
