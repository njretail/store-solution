-- 기기 재시작/종료, 프로그램 재시작, 일일 예약 재부팅 — 브라우저 자체로는 절대 할 수
-- 없는 영역이라(모든 브라우저가 보안상 막아둠), 키오스크 PC에 설치하는 별도 에이전트
-- (kiosk-agent/ 폴더, PowerShell 스크립트)가 이 값들을 읽어가서 실제 OS 명령을 실행한다.
-- remote_command는 이미 text라 체크 제약 없이 'restart_program'/'restart_device'/
-- 'shutdown_device'/'refresh' 전부 그대로 쓸 수 있어 컬럼 추가가 필요 없다.
alter table public.kiosks add column if not exists daily_reboot_time time;
