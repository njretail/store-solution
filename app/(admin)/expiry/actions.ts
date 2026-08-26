"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, getCurrentStore } from "@/lib/session";

export type ExpiryState = { error: string | null; success: string | null };

export async function recordExpiry(
  _prevState: ExpiryState,
  formData: FormData
): Promise<ExpiryState> {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const product_id = String(formData.get("product_id") ?? "");
  const expiry_date = String(formData.get("expiry_date") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!product_id || !expiry_date || !quantity || quantity <= 0) {
    return { error: "상품, 소비기한, 수량을 확인하세요.", success: null };
  }

  const { error } = await supabase.from("product_expiries").insert({
    store_id: store.id,
    product_id,
    expiry_date,
    quantity,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/expiry");
  revalidatePath("/dashboard");
  return { error: null, success: "소비기한 정보가 등록되었습니다." };
}
