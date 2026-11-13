import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKioskPhone, rejectUnlessKiosk } from "@/lib/kiosk-webhook";

// 셀프 계산대 "적립·할인" 단계: 손님이 번호를 넣으면 그 번호의 쓸 수 있는 쿠폰 목록을 돌려준다.
// 키오스크는 이 목록을 "보유 쿠폰" 화면에 보여 주고, 손님이 고른 쿠폰 id를 결제 때 함께 보낸다.
// 처음 온 번호면 쿠폰 대신 첫 구매 할인 대상임을 알려준다(할인 계산은 결제 시 서버가 다시 한다).
//
// 요청: POST { "store_id": "<stores.id>", "phone": "01012345678" }
// 응답: { "is_new_customer": false, "first_purchase_discount": 0,
//         "coupons": [{ "id", "title", "discount_type", "discount_value", "expires_at" }] }
// 개인정보 최소화: 이름 등 고객 정보는 돌려주지 않는다.
const FIRST_PURCHASE_DISCOUNT = 500; // record_sale의 첫 구매 할인과 같은 값

export async function POST(request: NextRequest) {
  const denied = rejectUnlessKiosk(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const storeId = String(body?.store_id ?? "");
  const phone = normalizeKioskPhone(body?.phone);
  if (!storeId) return NextResponse.json({ error: "store_id가 필요합니다." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인하세요." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", storeId)
    .eq("phone", phone)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ is_new_customer: true, first_purchase_discount: FIRST_PURCHASE_DISCOUNT, coupons: [] });
  }

  const { data: coupons, error } = await supabase
    .from("customer_coupons")
    .select("id, title, discount_type, discount_value, expires_at")
    .eq("customer_id", customer.id)
    .is("redeemed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("customer coupons lookup failed", error.message);
    return NextResponse.json({ error: "쿠폰을 불러오지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ is_new_customer: false, first_purchase_discount: 0, coupons: coupons ?? [] });
}
