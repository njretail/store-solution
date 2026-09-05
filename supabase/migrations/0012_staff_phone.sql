-- 아이디(이메일) 찾기 기능을 위해 직원 프로필에 전화번호를 추가한다.
alter table public.profiles
  add column if not exists phone text;
