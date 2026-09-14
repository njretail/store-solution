"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireAdmin, getCurrentStore } from "@/lib/session";
import { setDeliveryStatus } from "@/lib/delivery-status";
import type { DeliveryStatus } from "@/lib/types";

export type DeliveryOrderState = { error: string | null; success: string | null };

// 매장 직원이 실제로 포장/배차를 처리하므로 admin/staff 모두 상태를 바꿀 수 있다
// (현금관리/키오스크관리와 같은 접근 수준).
async function advance(id: string, next: DeliveryStatus) {
  const { supabase } = await requireProfile();
  const result = await setDeliveryStatus(supabase, id, next);
  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  return result;
}

export async function startPreparingDelivery(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "preparing");
}

export async function startOutForDelivery(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "out_for_delivery");
}

export async function markDelivered(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "delivered");
}

// 배송요청 단계에서만 취소할 수 있다 — 취소 버튼 자체가 그 단계에서만 보이지만,
// set_delivery_status RPC가 서버 쪽에서도 다시 한 번 막는다.
export async function cancelDelivery(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "cancelled");
}

// 기본 배송비 / 무료배송 기준금액 설정 — 현금관리의 알림기준 설정과 같은 패턴.
export async function updateDeliverySettings(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const feeRaw = String(formData.get("default_delivery_fee") ?? "").trim();
  const thresholdRaw = String(formData.get("free_shipping_threshold") ?? "").trim();
  const fee = feeRaw ? Math.max(0, Number(feeRaw) || 0) : 0;
  const threshold = thresholdRaw ? Math.max(0, Number(thresholdRaw) || 0) : null;

  await supabase
    .from("stores")
    .update({ default_delivery_fee: fee, free_shipping_threshold: threshold })
    .eq("id", store.id);

  revalidatePath("/deliveries");
}

// 관리자/직원이 직접 배송주문을 등록(전화주문 등) — 실제 키오스크가 붙기 전까지
// 이 화면으로도 배송주문건 기능 전체를 써볼 수 있게 하기 위함. 키오스크 웹훅
// (app/api/kiosk/delivery-orders)이 붙으면 같은 record_delivery_sale RPC를
// 그대로 재사용하므로 로직이 갈라지지 않는다.
export async function createDeliveryOrder(
  _prevState: DeliveryOrderState,
  formData: FormData
): Promise<DeliveryOrderState> {
  const { supabase } = await requireProfile();

  const itemsRaw = String(formData.get("items") ?? "[]");
  const address = String(formData.get("delivery_address") ?? "").trim();
  const phone = String(formData.get("delivery_phone") ?? "").trim() || null;
  const memo = String(formData.get("delivery_memo") ?? "").trim() || null;
  const payment_method = String(formData.get("payment_method") ?? "card");
  const store_id = String(formData.get("store_id") ?? "");

  let items: Array<{ product_id: string; quantity: number }>;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "장바구니 정보가 올바르지 않습니다.", success: null };
  }

  if (!store_id) return { error: "매장을 먼저 선택하세요.", success: null };
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "장바구니가 비어 있습니다.", success: null };
  }
  if (!address) {
    return { error: "배송지를 입력하세요.", success: null };
  }

  const { data, error } = await supabase.rpc("record_delivery_sale", {
    p_store_id: store_id,
    p_items: items,
    p_payment_method: payment_method,
    p_delivery_address: address,
    p_delivery_phone: phone,
    p_delivery_memo: memo,
  });

  if (error) return { error: error.message, success: null };

  revalidatePath("/deliveries");
  revalidatePath("/dashboard");

  const sale = data as { total_amount: number } | null;
  return {
    error: null,
    success: `배송주문이 등록되었습니다 (총 ${(sale?.total_amount ?? 0).toLocaleString()}원)`,
  };
}
