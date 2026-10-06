import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurchaseOrderStatus } from "./types";

export type TransitionResult = { ok: boolean; error?: string };

export type TransitionOptions = {
  // requested -> confirmed(검토 승인) 때만 쓴다. 비우면 요청 수량 그대로 승인.
  approvedQuantity?: number;
  // requested -> rejected, requested -> confirmed(검토 메모) 때 쓴다.
  memo?: string;
  // shipping -> delivered(입고 검수) 때 본부 채널에 쓴다. 비우면 발주 수량을
  // 그대로 믿고 반영한다(기존 동작과 동일 — 검수 없이도 안전하게 동작).
  receivedQuantity?: number;
  receivingMemo?: string;
  actorId?: string | null;
};

// 검토대기 -> 발주완료 -> 상품준비중 -> 배송중 -> 배송완료 5단계 + 반려/취소.
// 검토대기 단계에서만 승인(발주완료)하거나 반려할 수 있고, 발주완료 단계에서만
// 취소할 수 있다. 준비가 시작되면 되돌릴 수 없다.
const NEXT_ALLOWED: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  requested: ["confirmed", "rejected"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipping"],
  shipping: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

// 매장 관리자 화면의 버튼 클릭과, 본부 솔루션(별도 개발 중)이 나중에 붙을 웹훅
// (app/api/purchase-orders/status)이 모두 이 함수 하나를 거치게 해서 로직이
// 갈라지지 않게 한다. supabase는 쿠키 인증 클라이언트든 서비스 롤 클라이언트든
// 둘 다 받을 수 있다.
export async function setPurchaseOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  nextStatus: PurchaseOrderStatus,
  options: TransitionOptions = {}
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

  const update: Record<string, unknown> = { status: nextStatus };

  // 상품 검토: 승인하면서 수량을 조정했을 수 있다 — quantity 자체를 승인 수량으로
  // 맞춰서 이후 단계(상품준비중/배송중/재고반영)는 전부 이 값을 그대로 쓰게 한다.
  if (nextStatus === "confirmed" || nextStatus === "rejected") {
    update.reviewed_by = options.actorId ?? null;
    update.reviewed_at = new Date().toISOString();
    update.review_memo = options.memo ?? null;
    if (nextStatus === "confirmed" && options.approvedQuantity != null) {
      if (options.approvedQuantity <= 0) {
        return { ok: false, error: "승인 수량은 1 이상이어야 합니다." };
      }
      update.quantity = options.approvedQuantity;
      update.approved_quantity = options.approvedQuantity;
    }
  }

  // 입고 검수: 본부 채널이 배송완료로 넘어갈 때 실제 수령 수량만큼만 재고에
  // 반영한다(예정 수량을 그대로 믿지 않음). 수량을 안 넘기면 기존처럼 발주
  // 수량 전량을 반영한다 — 웹훅 등 수량 정보가 없는 호출도 깨지지 않게 하기 위함.
  // 쿠팡은 실제 도착 상품을 알 방법이 없어(바코드 미연동) 상태만 바뀌고, 재고는
  // 입고 등록에서 직접 등록해야 한다.
  if (nextStatus === "delivered" && order.channel === "hq") {
    const receivedQty = options.receivedQuantity ?? order.quantity;
    if (receivedQty <= 0) {
      return { ok: false, error: "입고 수량은 1 이상이어야 합니다." };
    }
    if (receivedQty > order.quantity) {
      return { ok: false, error: `발주 수량(${order.quantity})보다 많은 수량을 입고할 수 없습니다.` };
    }

    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: order.product_id,
      p_quantity: receivedQty,
      p_unit_cost: null,
      p_memo:
        receivedQty === order.quantity
          ? "본부 발주 배송완료 자동반영"
          : `본부 발주 배송완료 자동반영(오차: 발주 ${order.quantity} → 입고 ${receivedQty})`,
    });
    // 재고 반영이 실패하면 상태도 바꾸지 않는다 — 재고 없이 "배송완료"만 찍히는
    // 상황(실제로는 안 들어왔는데 들어온 것처럼 보이는 것)을 막기 위함.
    if (stockInError) return { ok: false, error: `재고 반영 실패: ${stockInError.message}` };

    update.received_quantity = receivedQty;
    update.receiving_memo = options.receivingMemo ?? null;
    update.received_by = options.actorId ?? null;
    update.received_at = new Date().toISOString();
  }

  const { error } = await supabase.from("purchase_orders").update(update).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
