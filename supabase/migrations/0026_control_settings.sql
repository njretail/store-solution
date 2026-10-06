-- 2-1 "항목마다 통제 수준을 고를 수 있는 구조" 구현. 기술 인수인계서 2-1 참고.
-- 통제 수준 3단계: hq_fixed(①본사 고정) / hq_default_store_adjust(②기본값+점포조정)
-- / store_free(③점포 자율). 적용 범위 우선순위: 개별 매장 > 매장 유형(직영/가맹) > 전체.
-- ⚠️ 지금은 역할이 admin/staff 2단계뿐이라 "점포가 못 고치게 막는" 실제 차단은
-- 아직 어디서도 호출하지 않는다(3번 본사/직영/가맹 메뉴 분리가 먼저 필요) — 이
-- 테이블은 정책을 정하고 기록해두는 용도이고, 역할이 분리되면 그 화면들이
-- resolve_control_level을 호출해서 바로 작동하게 만들면 된다.

alter table public.stores
  add column if not exists store_type text not null default 'direct'
    check (store_type in ('direct', 'franchise'));

create table public.control_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  scope_type text not null check (scope_type in ('global', 'store_type', 'store')),
  -- global이면 빈 문자열, store_type이면 'direct'|'franchise', store면 stores.id(text로 저장).
  -- null 대신 빈 문자열을 쓰는 이유: null은 unique 제약에서 서로 다른 값으로 취급돼
  -- 중복을 못 막는데, Supabase upsert(onConflict)는 부분 unique 인덱스를 못 써서
  -- 일반 unique 제약 하나로 세 범위를 전부 처리해야 하기 때문.
  scope_value text not null default '',
  control_level text not null check (control_level in ('hq_fixed', 'hq_default_store_adjust', 'store_free')),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (setting_key, scope_type, scope_value)
);

alter table public.control_settings enable row level security;

create policy "control_settings everyone select" on public.control_settings for select
  using (exists (select 1 from public.current_profile() cp where cp.role is not null));

create policy "control_settings admin write" on public.control_settings for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
