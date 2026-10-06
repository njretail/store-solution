-- 키오스크 "실제 구매자 화면"에 필요한 데이터 — 원격 새로고침, 광고 이미지,
-- 커스텀 안내멘트(TTS 또는 업로드 오디오), 바코드 없는 상품의 화면 바코드판.
-- 화면 프로그램 자체는 이 프로젝트 안에 공개 라우트(/kiosk/[id])로 같이 만든다
-- (키오스크 하드웨어는 이 URL을 띄우는 브라우저면 된다). 그 화면은 로그인 세션이
-- 없으므로 서버 쪽에서 서비스 롤 키(admin 클라이언트, RLS 우회)로 읽어온다 —
-- /api/kiosk/delivery-orders와 같은 패턴. 그래서 아래 정책은 전부 admin/staff용만
-- 두고, anon 키로 바로 열람 가능한 공개 정책은 추가하지 않는다.

-- 원격 관리: admin이 "새로고침" 같은 명령을 보내면 kiosk 화면이 주기적으로 폴링하다가
-- remote_command_at이 바뀐 걸 감지하고 반영한다(새로고침 = location.reload()).
alter table public.kiosks
  add column if not exists remote_command text,
  add column if not exists remote_command_at timestamptz;

-- 광고 이미지 — 대기화면에 순서대로 돌아가며 노출. kiosk_id가 null이면 그 매장의
-- 모든 키오스크 공통으로 노출(매장 전체 공용 광고).
create table public.kiosk_ads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  kiosk_id uuid references public.kiosks (id),
  image_url text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.kiosk_ads enable row level security;

create policy "kiosk_ads admin all" on public.kiosk_ads for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "kiosk_ads staff select" on public.kiosk_ads for select
  using (store_id = (select store_id from public.current_profile()));

-- 안내멘트 — message는 화면 문구로도 보여주고, audio_url이 있으면 그 오디오를,
-- 없으면 브라우저 TTS(speechSynthesis)로 읽어준다. kiosk_id가 null이면 매장 공통.
create table public.kiosk_announcements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  kiosk_id uuid references public.kiosks (id),
  message text not null,
  audio_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.kiosk_announcements enable row level security;

create policy "kiosk_announcements admin all" on public.kiosk_announcements for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "kiosk_announcements staff select" on public.kiosk_announcements for select
  using (store_id = (select store_id from public.current_profile()));

-- 바코드 없는 상품(생물/즉석조리 등) 중 키오스크 화면의 "바코드판"에 띄울 상품 표시.
alter table public.products add column if not exists show_on_kiosk_board boolean not null default false;
