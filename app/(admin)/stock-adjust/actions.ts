"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import type { StockAdjustmentReason } from "@/lib/types";

export type StockAdjustState = { error: string | null; success: string | null };

export async function recordStockAdjustment(
  _prevState: StockAdjustState,
  formData: FormData
): Promise<StockAdjustState> {
  const { supabase } = await requireProfile();

  const product_id = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  const reason = String(formData.get("reason") ?? "") as StockAdjustmentReason;
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!product_id || quantity <= 0) {
    return { error: "차감 수량을 확인하세요.", success: null };
  }

  const { error } = await supabase.rpc("record_stock_adjustment", {
    p_product_id: product_id,
    p_quantity: quantity,
    p_reason: reason,
    p_memo: memo,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/stock-adjust");
  revalidatePath("/products");
  revalidatePath("/products/low-stock");
  return { error: null, success: "재고조정이 등록되었습니다." };
}
