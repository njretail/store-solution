"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { runWinbackScan } from "@/lib/winback-scan";
import type { CampaignType } from "@/lib/types";

export type IssueCouponState = { error: string | null; success: string | null };

export async function issueCoupon(
  _prevState: IssueCouponState,
  formData: FormData
): Promise<IssueCouponState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const customerId = String(formData.get("customer_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const discountType = String(formData.get("discount_type") ?? "amount");
  const discountValue = Number(formData.get("discount_value") ?? 0);
  const campaignType = String(formData.get("campaign_type") ?? "manual") as CampaignType;
  const expiresInDays = Number(formData.get("expires_in_days") ?? 0);

  if (!customerId || !title || discountValue <= 0) {
    return { error: "쿠폰명과 할인값을 입력하세요.", success: null };
  }

  const expiresAt =
    expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase.from("customer_coupons").insert({
    store_id: store.id,
    customer_id: customerId,
    title,
    discount_type: discountType,
    discount_value: discountValue,
    campaign_type: campaignType,
    expires_at: expiresAt,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null, success: "쿠폰을 발급했습니다. 고객이 다음 결제 시 전화번호를 입력하면 자동 적용됩니다." };
}

export async function runWinbackScanNow(): Promise<{ error: string | null; issuedCount: number }> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", issuedCount: 0 };

  const issued = await runWinbackScan(supabase, store.id);

  revalidatePath("/customers");
  return { error: null, issuedCount: issued.length };
}
