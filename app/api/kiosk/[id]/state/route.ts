import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 키오스크 화면(/kiosk/[id])과 PC에 설치하는 kiosk-agent(PowerShell)가 함께 폴링하는
// 공개 엔드포인트 — 상태(점검중 등), 원격 명령(새로고침/프로그램·기기 재시작/종료),
// 일일 예약 재부팅 시각을 돌려준다. 로그인이 없는 키오스크 쪽에서 호출하므로 서비스 롤로 읽는다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  return NextResponse.json(data);
}
