import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { healthProblems, raiseKioskAlert, recordHeartbeat } from "@/lib/kiosk-alerts";
import type { KioskHealth } from "@/lib/types";

// kiosk-agent가 "상태 점검" 명령을 받았을 때(그리고 30분마다) 기기 상태를 보내는 공개 엔드포인트.
// 결과는 키오스크 관리 화면에 그대로 보이고, 문제가 있으면 "키오스크 오류" 알림을 만든다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as KioskHealth | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined);
  const strs = (v: unknown) =>
    Array.isArray(v) ? v.slice(0, 20).map((x) => String(x).slice(0, 200)) : undefined;
  const health: KioskHealth = {
    uptime_hours: num(body.uptime_hours),
    cpu_percent: num(body.cpu_percent),
    memory_used_percent: num(body.memory_used_percent),
    disk_free_gb: num(body.disk_free_gb),
    browser_running: typeof body.browser_running === "boolean" ? body.browser_running : undefined,
    network_ms: body.network_ms === null ? null : num(body.network_ms),
    device_errors: strs(body.device_errors),
    problems: strs(body.problems),
    agent_version: body.agent_version ? String(body.agent_version).slice(0, 20) : undefined,
  };

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("id, store_id, name").eq("id", id).maybeSingle();
  if (!kiosk) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await admin
    .from("kiosks")
    .update({ last_health: health, last_health_at: new Date().toISOString() })
    .eq("id", id);
  await recordHeartbeat(admin, id, "agent");

  const problems = healthProblems(health);
  if (problems.length > 0) {
    await raiseKioskAlert(admin, kiosk, "kiosk_error", `상태 점검 이상: ${problems.join(", ")}`);
  }

  return NextResponse.json({ ok: true, problems });
}
