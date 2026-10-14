import type { SupabaseClient } from "@supabase/supabase-js";
import type { KioskHealth, UrgentAlertType } from "@/lib/types";

// 키오스크 장비 알림 — 키오스크 쪽 공개 엔드포인트(/api/kiosk/*)에서 서비스 롤 클라이언트로 쓴다.
// 알림은 urgent_alerts에 쌓여 관리자 화면 빨간 배너(15초 폴링)로 즉시 뜨고, 일일 요약의
// "키오스크·장비 알림"에 하루 단위로 정리된다.

export const OFFLINE_THRESHOLD_MINUTES = 5;

type KioskRef = { id: string; store_id: string; name: string };

// 같은 기기·같은 종류·같은 내용의 미해결 알림이 이미 있으면 새로 만들지 않는다(연속 보고로 배너가
// 도배되는 것과, 공개 엔드포인트를 통한 반복 호출을 막는다).
export async function raiseKioskAlert(
  admin: SupabaseClient,
  kiosk: KioskRef,
  type: Extract<UrgentAlertType, "kiosk_offline" | "kiosk_error" | "change_failed">,
  message: string
) {
  const { data: existing } = await admin
    .from("urgent_alerts")
    .select("id")
    .eq("kiosk_id", kiosk.id)
    .eq("type", type)
    .eq("message", message)
    .eq("resolved", false)
    .limit(1);
  if (existing && existing.length > 0) return;

  await admin.from("urgent_alerts").insert({
    store_id: kiosk.store_id,
    kiosk_id: kiosk.id,
    type,
    message,
    source: kiosk.name,
  });
}

// 생존 신호 기록. 신호가 끊겼다가 다시 오면:
//  - 이미 "응답 없음" 알림이 떠 있으면 → 복구 시각을 붙여 자동 해결
//  - 아무도 감지하지 못한 채 복구됐으면(관리자 화면이 닫혀 있었고 pg_cron도 없을 때) →
//    해결된 상태로 기록만 남겨 일일 요약에는 잡히게 한다
export async function recordHeartbeat(
  admin: SupabaseClient,
  kioskId: string,
  source: "screen" | "agent"
) {
  const { data: kiosk } = await admin
    .from("kiosks")
    .select("id, store_id, name, status, screen_last_seen_at, agent_last_seen_at")
    .eq("id", kioskId)
    .maybeSingle();
  if (!kiosk) return;

  const now = new Date();
  const lastValues = [kiosk.screen_last_seen_at, kiosk.agent_last_seen_at].filter(Boolean) as string[];
  const lastSeen = lastValues.length ? new Date(Math.max(...lastValues.map((v) => Date.parse(v)))) : null;

  await admin
    .from("kiosks")
    .update(source === "screen" ? { screen_last_seen_at: now.toISOString() } : { agent_last_seen_at: now.toISOString() })
    .eq("id", kioskId);

  const gapMinutes = lastSeen ? (now.getTime() - lastSeen.getTime()) / 60000 : 0;
  const recoveredNote = `${now.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })} 복구`;

  const { data: open } = await admin
    .from("urgent_alerts")
    .select("id, message")
    .eq("kiosk_id", kioskId)
    .eq("type", "kiosk_offline")
    .eq("resolved", false);

  if (open && open.length > 0) {
    for (const a of open) {
      await admin
        .from("urgent_alerts")
        .update({ resolved: true, resolved_at: now.toISOString(), message: `${a.message} (${recoveredNote})` })
        .eq("id", a.id);
    }
    return;
  }

  if (lastSeen && gapMinutes >= OFFLINE_THRESHOLD_MINUTES && kiosk.status !== "maintenance") {
    await admin.from("urgent_alerts").insert({
      store_id: kiosk.store_id,
      kiosk_id: kiosk.id,
      type: "kiosk_offline",
      message: `키오스크 "${kiosk.name}"가 약 ${Math.round(gapMinutes)}분간 응답이 없었습니다 (${recoveredNote}).`,
      source: kiosk.name,
      resolved: true,
      resolved_at: now.toISOString(),
    });
  }
}

// 상태 점검 결과에서 사람이 봐야 할 문제만 뽑는다. kiosk-agent가 보낸 problems도 그대로 합친다.
export function healthProblems(h: KioskHealth): string[] {
  const problems = new Set<string>(Array.isArray(h.problems) ? h.problems.map(String) : []);
  if (h.browser_running === false) problems.add("키오스크 화면(브라우저)이 꺼져 있음");
  if (typeof h.disk_free_gb === "number" && h.disk_free_gb < 2) problems.add(`디스크 여유 공간 부족(${h.disk_free_gb}GB)`);
  if (typeof h.memory_used_percent === "number" && h.memory_used_percent >= 95)
    problems.add(`메모리 사용률 높음(${h.memory_used_percent}%)`);
  if (h.network_ms === null) problems.add("서버 연결 확인 실패");
  for (const d of Array.isArray(h.device_errors) ? h.device_errors : []) problems.add(`장치 오류: ${d}`);
  return [...problems].slice(0, 10);
}
