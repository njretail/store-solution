import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setPurchaseOrderStatus } from "@/lib/purchase-order-status";
import type { PurchaseOrderStatus } from "@/lib/types";

const VALID_STATUSES: PurchaseOrderStatus[] = [
  "confirmed",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
];

// 본부 솔루션(별도로 개발 중인 시스템)이 발주 상태를 바꿀 때 호출할 웹훅.
// 이 store-solution 앱은 매장점주가 쓰는 앱이고, 여러 매장을 취합 관리하는
// 본부 쪽 화면은 별도 솔루션에서 만든다 — 그쪽에서 발주 상태를 바꾸면 이
// 엔드포인트를 호출해 여기 DB에도 반영해달라고 붙여주면 된다.
//
// 인증: Vercel Cron의 CRON_SECRET과 같은 패턴으로 HQ_WEBHOOK_SECRET 환경변수를
// 설정해두면 "Authorization: Bearer <값>" 헤더로 검증한다. 아직 본부 솔루션이
// 없어 값이 비어있는 동안은 이 엔드포인트 자체를 막아둔다(빈 시크릿으로 우회
// 호출되는 걸 막기 위함).
//
// 요청 형식: POST { "order_id": "<purchase_orders.id>", "status": "confirmed" | "preparing" | "shipping" | "delivered" | "cancelled" }
export async function POST(request: NextRequest) {
  const secret = process.env.HQ_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId = String(body?.order_id ?? body?.id ?? "");
  const status = body?.status;

  if (!orderId) {
    return NextResponse.json({ error: "order_id가 필요합니다." }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status는 ${VALID_STATUSES.join(", ")} 중 하나여야 합니다.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const result = await setPurchaseOrderStatus(supabase, orderId, status as PurchaseOrderStatus);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
