import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 도난/보안 센서, 냉장고 전원·온도 센서 등 외부 장비가 긴급 상황을 보낼 공개
// 수신 지점 — /api/purchase-orders/status, /api/kiosk/* 와 같은 패턴(시크릿 헤더로
// 인증, 미설정이면 막아둠). 지금은 실제로 호출하는 센서/보안 장비가 없어 연동 지점만
// 마련해둔 상태다. 들어오면 관리자 화면에 실시간 배너로 즉시 뜬다(UrgentAlertBanner).
//
// 요청 형식: POST {
//   "store_id": "<stores.id>",
//   "type": "theft" | "fridge_power" | "other",
//   "message": "냉동고 전원이 끊겼습니다" 같은 사람이 읽을 설명,
//   "source": "냉동고1 센서"   // 선택, 어느 장비에서 왔는지
// }
export async function POST(request: NextRequest) {
  const secret = process.env.ALERT_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const store_id = String(body?.store_id ?? "");
  const type = String(body?.type ?? "");
  const message = String(body?.message ?? "").trim();
  const source = body?.source ? String(body.source).trim() : null;

  if (!store_id) {
    return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  }
  if (type !== "theft" && type !== "fridge_power" && type !== "other") {
    return NextResponse.json({ error: "type은 theft/fridge_power/other 중 하나여야 합니다." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("urgent_alerts")
    .insert({ store_id, type, message, source })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alert: data });
}
