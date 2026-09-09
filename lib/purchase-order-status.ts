import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurchaseOrderStatus } from "./types";

export type TransitionResult = { ok: boolean; error?: string };

// 쇼핑몰 유통 흐름과 같은 4단계: 발주완료 -> 상품준비중 -> 배송중 -> 배송완료.
// 발주완료 단계에서만 취소할 수 있고, 준비가 시작되면 되돌릴 수 없다.
const NEXT_ALLOWED: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipping"],
  shipping: ["delivered"],
  delivered: [],
  cancelled: [],
};

// 매장 관리자 화면의 버튼 클릭과, 본부 솔루션(별도 개발 중)이 나중에 붙을 웹훅
// (app/api/purchase-orders/status)이 모두 이 함수 하나를 거치게 해서 로직이
// 갈라지지 않게 한다. supabase는 쿠키 인증 클라이언트든 서비스 롤 클라이언트든
// 둘 다 받을 수 있다.
export async function setPurchaseOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  nextStatus: PurchaseOrderStatus
): Promise<TransitionResult> {
  const { data: order } = await supabase
    .from("purchase_orders")
    .select("id, channel, status, product_id, quantity")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "발주를 찾을 수 없습니다." };

  const allowed = NEXT_ALLOWED[order.status as PurchaseOrderStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `${order.status} 상태에서는 ${nextStatus}(으)로 바꿀 수 없습니다.`,
    };
  }

  // 본부 발주가 배송완료로 넘어가면 상품·수량을 정확히 알고 있으니(바코드 스캔
  // 없이도) 재고에 바로 반영한다. 쿠팡은 실제 도착 상품을 알 방법이 없어(바코드
  // 미연동) 상태만 바뀌고, 재고는 입고 등록에서 직접 등록해야 한다.
  if (nextStatus === "delivered" && order.channel === "hq") {
    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: order.product_id,
      p_quantity: order.quantity,
      p_unit_cost: null,
      p_memo: "본부 발주 배송완료 자동반영",
    });
    // 재고 반영이 실패하면 상태도 바꾸지 않는다 — 재고 없이 "배송완료"만 찍히는
    // 상황(실제로는 안 들어왔는데 들어온 것처럼 보이는 것)을 막기 위함.
    if (stockInError) return { ok: false, error: `재고 반영 실패: ${stockInError.message}` };
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: nextStatus })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
