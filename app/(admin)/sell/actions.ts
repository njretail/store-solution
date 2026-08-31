"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export type SellState = { error: string | null; success: string | null };

export async function checkout(
  _prevState: SellState,
  formData: FormData
): Promise<SellState> {
  const { supabase } = await requireProfile();

  const itemsRaw = String(formData.get("items") ?? "[]");
  const payment_method = String(formData.get("payment_method") ?? "cash");
  const coupon_code = String(formData.get("coupon_code") ?? "").trim() || null;
  const discount_amount = Number(formData.get("discount_amount") ?? 0) || 0;
  const customer_phone = String(formData.get("customer_phone") ?? "").trim() || null;

  let items: Array<{ product_id: string; quantity: number }>;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "장바구니 정보가 올바르지 않습니다.", success: null };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "장바구니가 비어 있습니다.", success: null };
  }

  const { data, error } = await supabase.rpc("record_sale", {
    p_payment_method: payment_method,
    p_items: items,
    p_coupon_code: coupon_code,
    p_discount_amount: discount_amount,
    p_customer_phone: customer_phone,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/sell");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/customers");

  const sale = data as { total_amount: number; discount_amount: number; customer_id: string | null } | null;
  const total = sale?.total_amount ?? 0;
  const discount = sale?.discount_amount ?? 0;
  const discountNote = discount > 0 ? ` (할인 ${discount.toLocaleString()}원 적용)` : "";
  const customerNote = customer_phone ? " · 고객 적립됨" : "";
  return {
    error: null,
    success: `결제 완료 (총 ${total.toLocaleString()}원)${discountNote}${customerNote}`,
  };
}
