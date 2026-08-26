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
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/sell");
  revalidatePath("/sales");

  const total = (data as { total_amount: number } | null)?.total_amount ?? 0;
  return { error: null, success: `결제 완료 (총 ${total.toLocaleString()}원)` };
}
