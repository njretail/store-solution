-- 키오스크 화면 문구/배너 관리 — 오더인 매뉴얼의 "화면 관리 및 설정 / 상단 배너,
-- 안내 문구 관리 / 안내 멘트 관리"에 해당. 실제 키오스크 화면 프로그램은 아직 없지만,
-- 나중에 붙을 때 그대로 읽어가도록 문구를 미리 설정해둘 수 있게 컬럼만 추가한다.
alter table public.kiosks
  add column if not exists notice_message text,
  add column if not exists banner_message text;
