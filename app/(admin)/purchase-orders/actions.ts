"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createCoupangDeepLink } from "@/lib/coupang-partners";

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

// 쿠팡 발주: 파트너스 딥링크를 생성해 기록하고, 직원이 클릭해 쿠팡 결제를 직접 완료하도록
// 링크를 반환한다(쿠팡은 구매 자동결제 API를 제공하지 않아 결제 자체는 사람이 완료해야 함).
export async function createCoupangOrder(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", link: null };

  const product_id = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  const coupang_product_url = String(formData.get("coupang_product_url") ?? "").trim();
  if (!product_id || quantity <= 0) {
    return { error: "발주 수량을 입력하세요.", link: null };
  }
  if (!coupang_product_url) {
    return { error: "이 상품에 등록된 쿠팡 상품 URL이 없습니다. 먼저 등록해주세요.", link: null };
  }

  const link = await createCoupangDeepLink(coupang_product_url);

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

export async function markOrderReceived(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

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
