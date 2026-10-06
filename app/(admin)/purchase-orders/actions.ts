"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createCoupangDeepLink, buildCoupangSearchUrl } from "@/lib/coupang-partners";
import { setPurchaseOrderStatus, type TransitionOptions } from "@/lib/purchase-order-status";

export type OrderActionState = { error: string | null; link: string | null };

// 본부 발주: 검토대기 상태로 접수한다 — 본사 역할(지금은 같은 관리자)이 재고소진상품/
// 발주관리에서 승인해야 발주완료로 넘어간다.
export async function createHqOrder(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", link: null };

  const product_id = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  if (!product_id || quantity <= 0) {
    return { error: "발주 수량을 입력하세요.", link: null };
  }

  const { error } = await supabase.from("purchase_orders").insert({
    store_id: store.id,
    product_id,
    quantity,
    channel: "hq",
    source: "manual",
    status: "requested",
    created_by: profile.id,
  });
  if (error) return { error: error.message, link: null };

  revalidatePath("/products");
  revalidatePath("/purchase-orders");
  return { error: null, link: null };
}

// 여러 상품의 수량을 한 번에 입력해두고 "전체 발주" 한 번으로 본부 발주를 몰아서
// 넣는다. 쿠팡은 상품마다 링크를 열어 직접 결제해야 해서 일괄 처리 대상이 아니다.
export async function createBulkHqOrders(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const ids = formData.getAll("bulk_order_ids").map(String);
  if (ids.length === 0) return;

  const rows = ids
    .map((id) => ({
      store_id: store.id,
      product_id: id,
      quantity: Number(formData.get(`bulk_qty_${id}`) ?? 0) || 0,
      channel: "hq" as const,
      source: "manual" as const,
      status: "requested" as const,
      created_by: profile.id,
    }))
    .filter((r) => r.quantity > 0);
  if (rows.length === 0) return;

  await supabase.from("purchase_orders").insert(rows);
  revalidatePath("/products");
  revalidatePath("/purchase-orders");
}

// 쿠팡 발주: 상품별 URL을 등록해두지 않으므로 상품명으로 쿠팡 검색 결과를 열고,
// 그 링크를 파트너스 딥링크로 변환해 기록한다. 직원이 새 탭에서 상품을 찾아
// 직접 주문/결제까지 완료해야 한다(쿠팡은 자동결제 API를 제공하지 않음).
export async function createCoupangOrder(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", link: null };

  const product_id = String(formData.get("product_id") ?? "");
  const product_name = String(formData.get("product_name") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  if (!product_id || quantity <= 0) {
    return { error: "발주 수량을 입력하세요.", link: null };
  }
  if (!product_name) {
    return { error: "상품 정보를 확인할 수 없습니다.", link: null };
  }

  const link = await createCoupangDeepLink(buildCoupangSearchUrl(product_name));

  const { error } = await supabase.from("purchase_orders").insert({
    store_id: store.id,
    product_id,
    quantity,
    channel: "coupang",
    source: "manual",
    status: "requested",
    coupang_link: link,
    created_by: profile.id,
  });
  if (error) return { error: error.message, link: null };

  revalidatePath("/products");
  revalidatePath("/purchase-orders");
  return { error: null, link };
}

// 검토대기 -> 발주완료 -> 상품준비중 -> 배송중 -> 배송완료로 한 단계씩 넘긴다. 실제
// 전환 규칙과 (검토 승인 시 수량조정, 배송완료 시 입고검수 수량만 재고반영) 로직은
// lib/purchase-order-status.ts에 모아뒀다 — 나중에 붙을 본부 솔루션 웹훅
// (app/api/purchase-orders/status)도 같은 함수를 거치므로 여기서 버튼으로 바꾸든
// 그쪽에서 바꾸든 동작이 갈라지지 않는다.
async function advance(
  id: string,
  next: "confirmed" | "preparing" | "shipping" | "delivered" | "rejected" | "cancelled",
  options?: TransitionOptions
) {
  const { supabase, profile } = await requireAdmin();
  const result = await setPurchaseOrderStatus(supabase, id, next, {
    ...options,
    actorId: profile.id,
  });
  if (result.ok && next === "delivered") {
    revalidatePath("/products");
  }
  revalidatePath("/purchase-orders");
  return result;
}

// 상품 검토 — 승인: 요청 수량을 그대로 쓰거나(quantity 비우면) 본사가 수량을 조정해서
// 승인할 수 있다. 승인되면 발주완료로 넘어간다.
export async function approveOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim() || undefined;
  await advance(id, "confirmed", {
    approvedQuantity: quantityRaw ? Number(quantityRaw) || undefined : undefined,
    memo,
  });
}

// 상품 검토 — 반려: 검토대기 단계에서만 가능하고, 발주 자체가 취소된다(재고는 아직
// 전혀 반영되지 않은 시점이라 원복할 것도 없음).
export async function rejectOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const memo = String(formData.get("memo") ?? "").trim() || undefined;
  await advance(id, "rejected", { memo });
}

export async function startPreparing(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "preparing");
}

export async function startShipping(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "shipping");
}

// 입고 검수 — 본부 채널은 예정(발주) 수량과 실제 수령 수량을 비교해서, 오차가 있으면
// 실제 수령 수량만큼만 재고에 반영한다(모자라게 와도 온 만큼만, 더 와도 온 만큼만).
// 쿠팡 채널은 수량 입력칸 자체가 없으므로 기존처럼 상태만 바뀐다.
export async function markOrderDelivered(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const quantityRaw = String(formData.get("received_quantity") ?? "").trim();
  const memo = String(formData.get("receiving_memo") ?? "").trim() || undefined;
  await advance(id, "delivered", {
    receivedQuantity: quantityRaw ? Number(quantityRaw) || undefined : undefined,
    receivingMemo: memo,
  });
}

// 발주완료 단계에서만 취소할 수 있다 — 준비가 시작된 뒤에는 취소 버튼 자체가
// 안 보이지만, 서버에서도 setPurchaseOrderStatus의 전환 규칙으로 다시 막는다.
export async function cancelOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await advance(id, "cancelled");
}
