-- 키오스크 장비 이상 알림 + 기기 상태 점검.
--
-- 1) 생존 신호(heartbeat): 키오스크 화면(/kiosk/[id])과 PC의 kiosk-agent가 30초 안팎마다
--    /api/kiosk/[id]/state를 호출할 때 마지막 응답 시각을 남긴다. 일정 시간(5분) 이상 신호가
--    없으면 "키오스크 응답 없음" 알림을 만들고, 다시 신호가 오면 자동으로 해결 처리한다.
-- 2) 장비 오류 알림: 거스름돈 미지급(계좌이체 요청 접수), 기기 상태 점검 이상, 외부 장비 보고.
-- 3) 상태 점검 결과: kiosk-agent가 보낸 최근 점검 결과(JSON)를 키오스크 행에 저장.
--
-- 알림은 기존 긴급 알림(urgent_alerts)에 쌓는다 — 관리자 화면 빨간 배너로 즉시 뜨고,
-- 해결 여부와 상관없이 일일 요약의 "키오스크·장비 알림"에 하루 단위로 정리된다.

alter table public.kiosks
  add column if not exists screen_last_seen_at timestamptz,
  add column if not exists agent_last_seen_at timestamptz,
  add column if not exists last_health jsonb,
  add column if not exists last_health_at timestamptz;

alter table public.urgent_alerts drop constraint if exists urgent_alerts_type_check;
alter table public.urgent_alerts add constraint urgent_alerts_type_check
  check (type in ('theft', 'fridge_power', 'other', 'kiosk_offline', 'kiosk_error', 'change_failed'));

alter table public.urgent_alerts
  add column if not exists kiosk_id uuid references public.kiosks (id) on delete set null;

create index if not exists urgent_alerts_store_created_idx on public.urgent_alerts (store_id, created_at desc);

-- 응답 없는 키오스크 감지 — 점검중으로 돌려둔 기기, 한 번도 신호가 온 적 없는(아직 설치 전)
-- 기기는 제외한다. 같은 기기에 해결 안 된 "응답 없음" 알림이 이미 있으면 또 만들지 않는다.
-- 관리자 화면(긴급 알림 배너)이 폴링할 때마다 호출되고, pg_cron이 켜져 있으면 1분마다도 돈다.
create or replace function public.detect_offline_kiosks(p_threshold_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_kiosk record;
  v_last timestamptz;
begin
  for v_kiosk in
    select k.id, k.store_id, k.name,
           greatest(k.screen_last_seen_at, k.agent_last_seen_at) as last_seen
    from public.kiosks k
    where k.status <> 'maintenance'
      and coalesce(k.screen_last_seen_at, k.agent_last_seen_at) is not null
  loop
    v_last := v_kiosk.last_seen;
    if v_last < now() - make_interval(mins => p_threshold_minutes)
       and not exists (
         select 1 from public.urgent_alerts a
         where a.kiosk_id = v_kiosk.id and a.type = 'kiosk_offline' and a.resolved = false
       ) then
      insert into public.urgent_alerts (store_id, kiosk_id, type, message, source)
      values (
        v_kiosk.store_id,
        v_kiosk.id,
        'kiosk_offline',
        format('키오스크 "%s"가 %s분 넘게 응답이 없습니다. 전원·네트워크를 확인하세요.', v_kiosk.name, p_threshold_minutes),
        v_kiosk.name
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.detect_offline_kiosks(integer) to authenticated;

-- pg_cron이 있으면 1분마다 감지 — 관리자 화면을 아무도 안 열어둔 시간에도 알림 기록이
-- 남아 일일 요약에 잡히게 한다. pg_cron을 쓸 수 없는 환경이면 조용히 건너뛴다(그때는
-- 관리자 화면이 열려 있을 때와 기기가 다시 연결될 때 감지된다).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'detect-offline-kiosks';
  perform cron.schedule('detect-offline-kiosks', '* * * * *', 'select public.detect_offline_kiosks(5)');
exception when others then
  raise notice 'pg_cron 예약을 건너뜁니다: %', sqlerrm;
end;
$$;
