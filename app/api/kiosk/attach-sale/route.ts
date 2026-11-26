import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKioskPhone, rejectUnlessKiosk } from "@/lib/kiosk-webhook";

// 셀프 계산대 "결제 후 적립": 번호 입력을 건너뛰고 결제한 손님이 완료 화면에서 번호를 넣으면
// 방금 끝난 판매에 고객을 붙인다. 할인은 없고 적립(구매 이력 연결)만 한다.
// 고객이 없는 판매, 결제 후 30분 이내만 가능하다(DB 함수 attach_customer_to_sale에서 검사).
//
// 요청: POST { "store_id": "<stores.id>", "sale_id": "<sales.id>", "phone": "01012345678" }
// 응답: { "sale_id": "...", "customer_id": "...", "points_earned": 0 }  (포인트가 켜진 매장이면 이때 적립된다)
export async function POST(request: NextRequest) {
  const denied = rejectUnlessKiosk(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const saleId = String(body?.sale_id ?? "");
  const phone = normalizeKioskPhone(body?.phone);
  if (!storeId || !saleId) {
    return NextResponse.json({ error: "store_id와 sale_id가 필요합니다." }, { status: 400 });
  }
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인하세요." }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("attach_customer_to_sale", {
    p_store_id: storeId,
    p_sale_id: saleId,
    p_customer_phone: phone,
  });
  if (error) {
    // DB 함수가 손님에게 보여 줄 수 있는 문구로 막는다(이미 적립됨, 30분 지남 등)
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const sale = data as { id: string; customer_id: string; points_earned?: number };
  return NextResponse.json({ sale_id: sale.id, customer_id: sale.customer_id, points_earned: sale.points_earned ?? 0 });
}
