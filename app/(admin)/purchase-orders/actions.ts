"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createCoupangDeepLink, buildCoupangSearchUrl } from "@/lib/coupang-partners";

export type OrderActionState = { error: string | null; link: string | null };

// 본부 발주: 외부 결제가 필요 없어 바로 대기중 상태로 기록한다.
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
    status: "pending",
    created_by: profile.id,
  });
  if (error) return { error: error.message, link: null };

  revalidatePath("/products/low-stock");
  revalidatePath("/purchase-orders");
  return { error: null, link: null };
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
    status: "ordered",
    coupang_link: link,
    created_by: profile.id,
  });
  if (error) return { error: error.message, link: null };

  revalidatePath("/products/low-stock");
  revalidatePath("/purchase-orders");
  return { error: null, link };
}

// 본부 발주는 우리가 상품/수량을 정확히 알고 있으니(직접 매칭이 필요한 쿠팡과 달리)
// 입고완료 처리 시 record_stock_in RPC로 실제 재고에도 자동으로 더해준다.
// 쿠팡 발주는 실제로 무엇이 얼마나 도착했는지 시스템이 알 방법이 없어(바코드 연동 없음)
// 상태만 바꾸고, 재고는 여전히 입고 등록에서 직접 입력해야 한다.
export async function markOrderReceived(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: order } = await supabase
    .from("purchase_orders")
    .select("channel, status, product_id, quantity")
    .eq("id", id)
    .single();
  if (!order || (order.status !== "pending" && order.status !== "ordered")) return;

  if (order.channel === "hq") {
    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: order.product_id,
      p_quantity: order.quantity,
      p_unit_cost: null,
      p_memo: "본부 발주 입고완료 자동반영",
    });
    // 재고 반영이 실패하면 상태도 바꾸지 않는다 — 재고 없이 "입고완료"만 찍히는
    // 상황(실제로는 안 들어왔는데 들어온 것처럼 보이는 것)을 막기 위함.
    if (stockInError) return;
    revalidatePath("/products");
  }

  await supabase.from("purchase_orders").update({ status: "received" }).eq("id", id);
  revalidatePath("/purchase-orders");
}

export async function cancelOrder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/purchase-orders");
}
