import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordHeartbeat } from "@/lib/kiosk-alerts";

// 키오스크 화면(/kiosk/[id])과 PC에 설치하는 kiosk-agent(PowerShell)가 함께 폴링하는
// 공개 엔드포인트 — 상태(점검중 등), 원격 명령(새로고침/다시 로그인/상태 점검/프로그램·기기
// 재시작/종료), 일일 예약 재부팅 시각을 돌려준다. 로그인이 없는 키오스크 쪽에서 호출하므로
// 서비스 롤로 읽는다.
//
// ?hb=screen|agent를 붙여 부르면 생존 신호로도 기록한다 — 5분 넘게 신호가 없으면
// "키오스크 응답 없음" 알림이 뜨고(detect_offline_kiosks), 다시 신호가 오면 자동 해결된다.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("kiosks")
    .select("status, remote_command, remote_command_at, daily_reboot_time")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const hb = request.nextUrl.searchParams.get("hb");
  if (hb === "screen" || hb === "agent") {
    try {
      await recordHeartbeat(admin, id, hb);
    } catch (e) {
      // 생존 신호 기록 실패가 화면·에이전트의 명령 수신까지 막으면 안 된다.
      console.error("kiosk heartbeat failed", e);
    }
  }

  return NextResponse.json(data);
}
