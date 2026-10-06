-- 긴급 실시간 알림 — 도난/보안, 냉장고 전원 차단처럼 "하루 요약(daily-report)"까지
-- 기다리면 안 되는 사항을 위한 테이블. 실제 센서/보안 장비가 아직 없어서 지금 당장
-- 알림이 자동으로 생기진 않지만, 그 장비들이 연동될 공개 수신 지점(/api/alerts/urgent)과
-- 관리자 화면에 즉시 뜨는 배너는 미리 만들어둔다 — /api/kiosk/* 웹훅과 같은 패턴.
create table public.urgent_alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  type text not null check (type in ('theft', 'fridge_power', 'other')),
  message text not null,
  source text,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.urgent_alerts enable row level security;

create policy "urgent_alerts admin all" on public.urgent_alerts for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "urgent_alerts staff select" on public.urgent_alerts for select
  using (store_id = (select store_id from public.current_profile()));
create policy "urgent_alerts staff resolve" on public.urgent_alerts for update
  using (store_id = (select store_id from public.current_profile()))
  with check (store_id = (select store_id from public.current_profile()));
