-- 공지사항 게시판 — 오더인 매뉴얼의 "공지사항 및 알림 > 공지사항 조회"에 해당.
-- 카테고리처럼 모든 매장이 함께 보는 공용 게시판이다(본사가 전 매장에 공지하는
-- 용도). 작성/수정/삭제는 관리자만, 조회는 로그인한 누구나(관리자+직원) 가능.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements everyone select" on public.announcements for select
  using (exists (select 1 from public.current_profile() cp where cp.role is not null));

create policy "announcements admin write" on public.announcements for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
