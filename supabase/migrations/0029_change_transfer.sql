-- 잔돈(소액권) 부족 알림 기준 — 현금 전체 잔액(cash_alert_threshold)과 별개로,
-- 거스름돈을 줄 수 있는 소액권(1,000원 이하)이 부족해지는 상황을 따로 감지한다.
alter table public.stores add column if not exists change_alert_threshold integer;

-- 거스름돈이 모자라 고객에게 현금으로 다 돌려주지 못했을 때, 고객 계좌로 나중에
-- 송금하기 위한 요청 목록. 지금은 POS 결제 흐름에 자동으로 연결돼 있지 않고(판매
-- 중 거스름돈 부족을 자동으로 감지하는 기능은 별도 구현 필요), 그 상황이 생기면
-- 직원이 이 화면에서 직접 계좌 정보를 받아 등록하는 방식이다.
create table public.change_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  sale_id uuid references public.sales (id),
  customer_name text,
  customer_phone text,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  memo text,
  requested_by uuid references public.profiles (id),
  paid_by uuid references public.profiles (id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.change_transfer_requests enable row level security;

create policy "change_transfer_requests admin all" on public.change_transfer_requests for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "change_transfer_requests staff select" on public.change_transfer_requests for select
  using (store_id = (select store_id from public.current_profile()));
create policy "change_transfer_requests staff insert" on public.change_transfer_requests for insert
  with check (store_id = (select store_id from public.current_profile()));
create policy "change_transfer_requests staff update" on public.change_transfer_requests for update
  using (store_id = (select store_id from public.current_profile()))
  with check (store_id = (select store_id from public.current_profile()));
