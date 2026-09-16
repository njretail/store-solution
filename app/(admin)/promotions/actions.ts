"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export type PromotionState = { error: string | null; success: string | null };

export async function createPromotion(
  _prevState: PromotionState,
  formData: FormData
): Promise<PromotionState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const product_id = String(formData.get("product_id") ?? "");
  const discount_type = String(formData.get("discount_type") ?? "amount");
  const discount_value = Number(formData.get("discount_value") ?? 0) || 0;
  const starts_at = String(formData.get("starts_at") ?? "");
  const ends_at = String(formData.get("ends_at") ?? "");

  if (!product_id) return { error: "상품을 먼저 조회하세요.", success: null };
  if (discount_value <= 0) return { error: "할인 값을 입력하세요.", success: null };
  if (!starts_at || !ends_at) return { error: "시작/종료 일시를 입력하세요.", success: null };
  if (new Date(ends_at) <= new Date(starts_at)) {
    return { error: "종료 일시는 시작 일시보다 뒤여야 합니다.", success: null };
  }

  const { error } = await supabase.from("promotions").insert({
    store_id: store.id,
    product_id,
    discount_type,
    discount_value,
    starts_at: new Date(starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    created_by: profile.id,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/promotions");
  return { error: null, success: "기간한정 할인이 등록되었습니다." };
}

export async function togglePromotion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await supabase.from("promotions").update({ active: !active }).eq("id", id);
  revalidatePath("/promotions");
}

export async function deletePromotion(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("promotions").delete().eq("id", id);
  revalidatePath("/promotions");
}
