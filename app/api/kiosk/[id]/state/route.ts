import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 키오스크 화면(/kiosk/[id])이 20초 간격으로 폴링하는 공개 엔드포인트 — 상태(점검중 등)와
// 원격 명령 시각만 돌려준다. 로그인이 없는 키오스크 하드웨어가 호출하므로 서비스 롤로 읽는다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("kiosks")
    .select("status, remote_command_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
