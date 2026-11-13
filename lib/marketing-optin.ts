import type { SupabaseClient } from "@supabase/supabase-js";

// 마케팅 수신 동의 + 감사 쿠폰 발급. 판매(POS) 화면과 키오스크 API가 같은 규칙을 쓰도록 한곳에 둔다.
// 결제 중에 받는 번호(할인·적립 확인용)와 달리, 이 번호를 마케팅에 쓰려면 반드시 이 동의를 거친다.
export const MARKETING_COUPON_VALUE = 1000;
export const MARKETING_COUPON_DAYS = 30;

export type MarketingOptInResult =
  | { ok: true; customerId: string; couponIssued: boolean }
  | { ok: false; error: string };

export async function optInMarketing(
  supabase: SupabaseClient,
  storeId: string,
  phone: string
): Promise<MarketingOptInResult> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("customers")
    .select("id, marketing_opt_in")
    .eq("store_id", storeId)
    .eq("phone", phone)
    .maybeSingle();

  let customerId = existing?.id as string | undefined;
  // 이미 동의한 고객이 다시 누르면 감사 쿠폰을 또 주지 않는다(같은 번호로 쿠폰을 반복해서 받는 것 방지).
  const alreadyOptedIn = existing?.marketing_opt_in === true;

  if (customerId) {
    if (!alreadyOptedIn) {
      await supabase
        .from("customers")
        .update({ marketing_opt_in: true, marketing_consent_at: now })
        .eq("id", customerId);
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from("customers")
      .insert({ store_id: storeId, phone, marketing_opt_in: true, marketing_consent_at: now })
      .select("id")
      .single();
    if (insertError || !created) {
      return { ok: false, error: insertError?.message ?? "등록에 실패했습니다." };
    }
    customerId = created.id as string;
  }

  if (alreadyOptedIn) return { ok: true, customerId: customerId!, couponIssued: false };

  const { error: couponError } = await supabase.from("customer_coupons").insert({
    store_id: storeId,
    customer_id: customerId,
    title: "마케팅 수신동의 감사쿠폰",
    discount_type: "amount",
    discount_value: MARKETING_COUPON_VALUE,
    campaign_type: "marketing_optin",
    expires_at: new Date(Date.now() + MARKETING_COUPON_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (couponError) {
    return { ok: false, error: `동의는 저장됐지만 쿠폰 발급에 실패했습니다: ${couponError.message}` };
  }
  return { ok: true, customerId: customerId!, couponIssued: true };
}
