-- 무인편의점 관리자페이지 8차 확장 스키마 (카메라보기)
-- 0001~0007 실행 이후, Supabase SQL Editor에서 실행하세요.

create table public.cameras (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  stream_url text,
  created_at timestamptz not null default now()
);

alter table public.cameras enable row level security;

create policy "cameras admin all" on public.cameras for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

create policy "cameras staff select" on public.cameras for select
  using (store_id = (select store_id from public.current_profile()));
