-- 무인편의점 관리자페이지 5차 확장 스키마 (현금관리, 키오스크관리)
-- 0001~0004 실행 이후, Supabase SQL Editor에서 실행하세요.

-- stores에 대한 update 정책이 아직 없어서(관리자가 현금 알림 기준을 저장하려면 필요) 추가
create policy "stores admin update" on public.stores for update
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

alter table public.stores
  add column if not exists cash_alert_threshold integer;

-- 현금관리: 수동 입금/출금 기록. 현재 잔액 = 현금 매출 합계 + 입금 합계 - 출금 합계 로 계산.
create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  type text not null check (type in ('deposit', 'withdrawal')),
  amount integer not null check (amount > 0),
  memo text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.cash_transactions enable row level security;

create policy "cash_transactions admin select" on public.cash_transactions for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "cash_transactions staff select" on public.cash_transactions for select
  using (store_id = (select store_id from public.current_profile()));

create policy "cash_transactions admin insert" on public.cash_transactions for insert
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "cash_transactions staff insert" on public.cash_transactions for insert
  with check (store_id = (select store_id from public.current_profile()));

-- 키오스크관리: 실제 장비 자동감지는 아직 없어 관리자가 직접 등록/상태 갱신하는 방식
create table public.kiosks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  status text not null default 'online' check (status in ('online', 'offline', 'maintenance')),
  memo text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.kiosks enable row level security;

create policy "kiosks admin all" on public.kiosks for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

create policy "kiosks staff select" on public.kiosks for select
  using (store_id = (select store_id from public.current_profile()));
