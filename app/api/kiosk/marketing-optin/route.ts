import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKioskPhone, rejectUnlessKiosk } from "@/lib/kiosk-webhook";
import { optInMarketing, MARKETING_COUPON_VALUE } from "@/lib/marketing-optin";

// 셀프 계산대 완료 화면 "다음 방문 혜택 → 쿠폰 받기": 마케팅 수신 동의를 저장하고 감사 쿠폰을
// 그 번호의 쿠폰함에 넣는다. 다음 결제 때 번호를 넣으면 /api/kiosk/customer-coupons 목록에 바로 보인다.
// 판매(POS) 화면의 "마케팅 소식 받아보기"와 같은 규칙(lib/marketing-optin.ts)을 쓴다.
// 이미 동의한 번호는 감사 쿠폰을 다시 주지 않는다.
//
// 요청: POST { "store_id": "<stores.id>", "phone": "01012345678", "consent": true }
// 응답: { "coupon_issued": true, "coupon_value": 1000 }
export async function POST(request: NextRequest) {
  const denied = rejectUnlessKiosk(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const phone = normalizeKioskPhone(body?.phone);
  if (!storeId) return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인하세요." }, { status: 400 });
  if (body?.consent !== true) {
    return NextResponse.json({ error: "마케팅 수신에 동의해야 쿠폰을 받을 수 있습니다." }, { status: 400 });
  }

  const result = await optInMarketing(createAdminClient(), storeId, phone);
  if (!result.ok) {
    console.error("kiosk marketing opt-in failed", result.error);
    return NextResponse.json({ error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({
    coupon_issued: result.couponIssued,
    coupon_value: result.couponIssued ? MARKETING_COUPON_VALUE : 0,
  });
}
