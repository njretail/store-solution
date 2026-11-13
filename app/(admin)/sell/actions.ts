"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, getCurrentStore } from "@/lib/session";
import { optInMarketing as optInMarketingForStore, MARKETING_COUPON_VALUE } from "@/lib/marketing-optin";

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

export type MarketingOptInState = { error: string | null; success: string | null };

// 결제 완료 후 "마케팅 소식 받아보기" 동의 — 결제 중에 입력하는 전화번호(할인/쿠폰
// 자동적용용)와는 별개다. 결제 중 번호는 동의 없이도 받지만, 그걸 마케팅에 쓰려면
// 이 화면에서 별도로 동의를 받아야 한다(기술 인수인계서 9번 "고객 개인정보 동의").
export async function optInMarketing(
  _prevState: MarketingOptInState,
  formData: FormData
): Promise<MarketingOptInState> {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const phone = String(formData.get("phone") ?? "").trim();
  const consent = formData.get("consent") === "true";

  if (!phone) return { error: "전화번호를 입력하세요.", success: null };
  if (!consent) {
    return { error: "개인정보 수집·이용에 동의해야 신청할 수 있습니다.", success: null };
  }

  const result = await optInMarketingForStore(supabase, store.id, phone);
  if (!result.ok) return { error: result.error, success: null };

  revalidatePath("/customers");
  if (!result.couponIssued) {
    return { error: null, success: "이미 소식 받기에 동의한 번호예요. 감사 쿠폰은 한 번만 드려요." };
  }
  return {
    error: null,
    success: `감사합니다! ${MARKETING_COUPON_VALUE.toLocaleString()}원 쿠폰이 발급됐어요 — 다음 결제 시 전화번호를 입력하면 자동 적용됩니다.`,
  };
}
