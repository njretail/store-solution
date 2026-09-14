import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryStatus } from "./types";

export type TransitionResult = { ok: boolean; error?: string };

// 배송요청 -> 상품준비중 -> 배송중 -> 배송완료 4단계. 배송요청 단계에서만
// 취소할 수 있고, 준비가 시작되면 되돌릴 수 없다(purchase-order-status.ts와 동일한 규칙).
// sales 테이블은 RPC로만 쓸 수 있게 설계돼 있어서(직접 update RLS 정책이 없음) 실제
// 전환 규칙 강제는 supabase/migrations/0017의 set_delivery_status 함수 쪽에서 최종적으로
// 한 번 더 하고, 이 함수는 그 RPC를 감싸는 얇은 래퍼다.
export async function setDeliveryStatus(
  supabase: SupabaseClient,
  saleId: string,
  nextStatus: DeliveryStatus
): Promise<TransitionResult> {
  const { error } = await supabase.rpc("set_delivery_status", {
    p_sale_id: saleId,
    p_status: nextStatus,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
