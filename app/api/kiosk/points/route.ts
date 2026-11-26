import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKioskPhone, rejectUnlessKiosk } from "@/lib/kiosk-webhook";
import { describePolicy, type PointSummary } from "@/lib/points";
import { CUSTOMER_CENTER } from "@/lib/support";

// 셀프 계산대 "적립·할인" 단계: 번호로 포인트 잔액과 매장 규칙을 돌려준다.
// 키오스크는 이걸로 "보유 1,450점 · 최대 N점 사용 가능" 화면을 그리고, 쓰려면 /api/kiosk/points/verify로
// 비밀번호를 확인해 받은 token과 쓸 포인트를 결제(record_sale의 p_use_points, p_point_token)에 함께 넘긴다.
//
// 요청: POST { "store_id": "<stores.id>", "phone": "01012345678" }
// 응답: { enabled, customer_exists, balance, pending, expiring_30d, has_pin, locked, can_use, policy, guide: [안내문...],
//         support: { phone, hours, forgot_pin } }  ← 비밀번호 입력 화면 아래에 support.forgot_pin을 띄우면 된다
// 개인정보 최소화: 이름 등은 돌려주지 않는다.
export async function POST(request: NextRequest) {
  const denied = rejectUnlessKiosk(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const phone = normalizeKioskPhone(body?.phone);
  if (!storeId) return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인하세요." }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("point_summary", { p_store_id: storeId, p_phone: phone });
  if (error) {
    console.error("kiosk point summary failed", error.message);
    return NextResponse.json({ error: "포인트를 불러오지 못했습니다." }, { status: 500 });
  }
  const summary = data as PointSummary;
  return NextResponse.json({
    ...summary,
    guide: summary.enabled ? describePolicy(summary.policy) : [],
    support: {
      phone: CUSTOMER_CENTER.phone,
      hours: CUSTOMER_CENTER.hours,
      forgot_pin: `비밀번호를 잊으셨나요? 고객센터 ${CUSTOMER_CENTER.phone} (${CUSTOMER_CENTER.hours})로 연락 주시면 초기화해 드려요. 포인트는 그대로 남아 있어요.`,
    },
  });
}
