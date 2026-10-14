import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseKioskAlert } from "@/lib/kiosk-alerts";

// 키오스크 장비 오류 보고 — 결제기·지폐/동전 방출기·영수증 프린터 같은 장비(또는 키오스크
// 업체 프로그램)가 오류를 알려줄 연동 지점. 지금은 kiosk-agent가 프로그램이 비정상 종료됐을 때
// 보고하고, 외부 장비 연동이 생기면 같은 형식으로 보내면 된다.
//
// 요청 형식: POST { "message": "동전 방출기 걸림", "device": "동전 방출기" }   // device는 선택
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const message = String(body?.message ?? "").trim().slice(0, 300);
  const device = String(body?.device ?? "").trim().slice(0, 50);
  if (!message) {
    return NextResponse.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("id, store_id, name").eq("id", id).maybeSingle();
  if (!kiosk) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await raiseKioskAlert(admin, kiosk, "kiosk_error", device ? `[${device}] ${message}` : message);
  return NextResponse.json({ ok: true });
}
