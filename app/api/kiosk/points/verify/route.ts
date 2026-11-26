import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKioskPhone, rejectUnlessKiosk } from "@/lib/kiosk-webhook";

// 포인트 사용 전 비밀번호(4자리) 확인. 맞으면 5분짜리 1회용 token을 준다.
// 비밀번호가 없는 손님(처음 사용)은 이 번호로 등록된다 — 키오스크 화면에서 두 번 입력받아 같을 때만 호출할 것.
// 5번 틀리면 10분 잠금(DB 함수 verify_point_pin).
//
// 요청: POST { "store_id": "<stores.id>", "phone": "01012345678", "pin": "5821" }
// 응답: 성공 { ok: true, token, created_pin } / 실패 { ok: false, error, attempts_left? } (실패도 200 — 화면에 문구만 띄우면 됨)
export async function POST(request: NextRequest) {
  const denied = rejectUnlessKiosk(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const phone = normalizeKioskPhone(body?.phone);
  const pin = String(body?.pin ?? "");
  if (!storeId) return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인하세요." }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("verify_point_pin", {
    p_store_id: storeId,
    p_phone: phone,
    p_pin: pin,
  });
  if (error) {
    console.error("kiosk point pin failed", error.message);
    return NextResponse.json({ error: "비밀번호를 확인하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json(data);
}
