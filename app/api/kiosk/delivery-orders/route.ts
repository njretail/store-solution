import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 실제 키오스크 시스템(별도 개발/도입 예정)이 구매자가 "배송으로 받기"를 선택한
// 주문을 전달할 웹훅. app/api/purchase-orders/status와 같은 패턴 — 아직 실제
// 키오스크 연동이 없어 이 엔드포인트를 호출하는 곳은 없다(연동 지점을 미리 만들어둔 것).
// 그동안은 관리자/직원이 /deliveries 화면에서 직접 등록해서 같은 기능을 쓸 수 있다.
//
// 인증: HQ_WEBHOOK_SECRET과 같은 패턴으로 KIOSK_WEBHOOK_SECRET 환경변수를 설정해두면
// "Authorization: Bearer <값>" 헤더로 검증한다. 값이 없는 동안은 막아둔다.
//
// 요청 형식: POST {
//   "store_id": "<stores.id>",
//   "items": [{ "barcode": "...", "quantity": 2 }, ...],
//   "payment_method": "card",            // 선택, 기본값 "card"
//   "kiosk_label": "1번 키오스크",          // 선택
//   "order_number": "...",               // 선택
//   "approval_number": "...",            // 선택
//   "payment_detail": "...",             // 선택
//   "delivery": { "address": "...", "phone": "...", "memo": "..." }
// }
export async function POST(request: NextRequest) {
  const secret = process.env.KIOSK_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const items = Array.isArray(body?.items) ? body.items : [];
  const delivery = body?.delivery ?? {};

  if (!storeId) {
    return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "items가 필요합니다." }, { status: 400 });
  }
  if (!delivery?.address) {
    return NextResponse.json({ error: "delivery.address가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("record_delivery_sale", {
    p_store_id: storeId,
    p_items: items,
    p_payment_method: body?.payment_method ?? "card",
    p_kiosk_label: body?.kiosk_label ?? null,
    p_order_number: body?.order_number ?? null,
    p_approval_number: body?.approval_number ?? null,
    p_payment_detail: body?.payment_detail ?? null,
    p_delivery_address: delivery?.address ?? null,
    p_delivery_phone: delivery?.phone ?? null,
    p_delivery_memo: delivery?.memo ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sale: data });
}
