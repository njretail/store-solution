"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";

export type StockInState = { error: string | null; success: string | null };

export async function recordStockIn(
  _prevState: StockInState,
  formData: FormData
): Promise<StockInState> {
  const { supabase } = await requireProfile();

  const product_id = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const unitCostRaw = formData.get("unit_cost");
  const unit_cost = unitCostRaw ? Number(unitCostRaw) : null;
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!product_id || !quantity || quantity <= 0) {
    return { error: "상품과 수량을 확인하세요.", success: null };
  }

  const { error } = await supabase.rpc("record_stock_in", {
    p_product_id: product_id,
    p_quantity: quantity,
    p_unit_cost: unit_cost,
    p_memo: memo,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/stock-in");
  return { error: null, success: `${quantity}개 입고 처리되었습니다.` };
}
