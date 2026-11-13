import { NextRequest, NextResponse } from "next/server";

// 실제 키오스크 시스템이 서버를 부를 때 쓰는 인증 — app/api/kiosk/delivery-orders와 같은 규칙.
// KIOSK_WEBHOOK_SECRET 환경변수를 "Authorization: Bearer <값>" 헤더로 검증하고, 값이 없는 동안은 막아둔다.
// 통과하면 null, 아니면 바로 돌려줄 401 응답을 준다.
export function rejectUnlessKiosk(request: NextRequest): NextResponse | null {
  const secret = process.env.KIOSK_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// 키오스크 숫자 패드로 받은 휴대폰 번호를 숫자만 남겨 정리한다. 형식이 틀리면 null.
export function normalizeKioskPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  return /^01\d{8,9}$/.test(digits) ? digits : null;
}
