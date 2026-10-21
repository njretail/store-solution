-- 고객의 소리 — 무인매장이라 고객이 원하는 상품이나 불편 사항을 말할 직원이 없다.
-- 그래서 키오스크 화면(/kiosk/[id]/voice)에서 고객이 직접 남기고, 관리자 화면
-- (/customer-voice)에서 모아 본다. 키오스크 쪽은 로그인 없는 공개 화면이라 등록은
-- 서비스 롤(/api/kiosk/voices)로만 한다 — 그래서 staff insert 정책은 두지 않는다.
--
-- 개인정보 최소 수집: 이름·연락처를 받지 않는 익명 의견이다(동의 절차 불필요).
create table public.customer_voices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  kiosk_id uuid references public.kiosks (id) on delete set null,
  -- 원하는 상품 요청 / 불편 사항 / 칭찬 / 기타
  kind text not null check (kind in ('product_request', 'complaint', 'compliment', 'other')),
  -- 키오스크에서 누른 분류 버튼(예: drinks, soldout) — 타이핑 없이도 남길 수 있게 한 것.
  tags text[] not null default '{}',
  message text check (char_length(message) <= 300),
  status text not null default 'new' check (status in ('new', 'reviewed', 'done')),
  admin_note text,
  handled_by uuid references public.profiles (id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_voices_store_created_idx on public.customer_voices (store_id, created_at desc);

alter table public.customer_voices enable row level security;

create policy "customer_voices admin all" on public.customer_voices for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "customer_voices staff select" on public.customer_voices for select
  using (store_id = (select store_id from public.current_profile()));
create policy "customer_voices staff update" on public.customer_voices for update
  using (store_id = (select store_id from public.current_profile()))
  with check (store_id = (select store_id from public.current_profile()));
