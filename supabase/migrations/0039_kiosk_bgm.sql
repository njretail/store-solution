-- 키오스크 매장 BGM — 관리자가 올린 음악 파일(가사 없는 반주 권장: 안내멘트·광고와 겹치므로)을
-- 키오스크 화면이 차례로 반복 재생한다. kiosk_id가 null이면 매장 공통.
create table if not exists public.kiosk_bgm_tracks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  kiosk_id uuid references public.kiosks (id),
  title text not null,
  audio_url text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.kiosk_bgm_tracks enable row level security;

-- 다시 실행해도 오류가 나지 않도록 기존 정책을 먼저 지우고 만든다
drop policy if exists "kiosk_bgm_tracks admin all" on public.kiosk_bgm_tracks;
drop policy if exists "kiosk_bgm_tracks staff select" on public.kiosk_bgm_tracks;
create policy "kiosk_bgm_tracks admin all" on public.kiosk_bgm_tracks for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "kiosk_bgm_tracks staff select" on public.kiosk_bgm_tracks for select
  using (store_id = (select store_id from public.current_profile()));

-- 매장별 BGM 사용 여부·음량(0~100). 안내멘트가 나오는 동안에는 키오스크가 이 음량의 15%로 줄인다.
-- announcement_gap_seconds: 대기 화면 안내멘트 하나가 끝나고 다음 멘트까지 쉬는 시간(그동안 BGM만 흐른다).
alter table public.stores
  add column if not exists bgm_enabled boolean not null default true,
  add column if not exists bgm_volume integer not null default 40 check (bgm_volume between 0 and 100),
  add column if not exists announcement_gap_seconds integer not null default 5
    check (announcement_gap_seconds between 0 and 300);
