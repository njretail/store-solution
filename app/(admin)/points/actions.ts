"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, getCurrentStore } from "@/lib/session";

function intIn(v: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(String(v ?? "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

export async function savePointPolicy(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) redirect("/points?error=" + encodeURIComponent("매장을 먼저 선택하세요."));

  const earnRate = Math.round(Math.min(Math.max(Number(formData.get("earn_rate") ?? 1) || 0, 0), 50) * 100) / 100;
  const row = {
    store_id: store.id,
    enabled: formData.get("enabled") === "on",
    earn_rate: earnRate,
    min_purchase_for_earn: intIn(formData.get("min_purchase_for_earn"), 0, 10_000_000, 0),
    available_after_days: intIn(formData.get("available_after_days"), 0, 365, 0),
    min_balance_to_use: intIn(formData.get("min_balance_to_use"), 0, 10_000_000, 1000),
    use_unit: intIn(formData.get("use_unit"), 1, 100_000, 100),
    max_use_rate: intIn(formData.get("max_use_rate"), 1, 100, 100),
    expire_months: intIn(formData.get("expire_months"), 0, 120, 12),
    require_pin: formData.get("require_pin") === "on",
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("point_policies").upsert(row, { onConflict: "store_id" });
  if (error) redirect("/points?error=" + encodeURIComponent("저장하지 못했습니다: " + error.message));
  revalidatePath("/points");
  revalidatePath("/sell");
  redirect("/points?saved=1");
}

export type AdjustState = { error: string | null; success: string | null };

/** 관리자 직접 지급(+)·차감(−). 전화번호 또는 고객 id로 찾는다. 사유는 내역에 남는다. */
export async function adjustPoints(_prev: AdjustState, formData: FormData): Promise<AdjustState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  let customerId = String(formData.get("customer_id") ?? "");
  const phone = String(formData.get("phone") ?? "").replace(/[^0-9]/g, "");
  const direction = String(formData.get("direction") ?? "add");
  const amount = Math.floor(Number(String(formData.get("amount") ?? "").replace(/[^0-9]/g, "")) || 0);
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 100);

  if (amount <= 0) return { error: "포인트를 입력하세요.", success: null };
  if (!memo) return { error: "사유를 입력하세요. (예: 이벤트 지급, 오적립 정정)", success: null };

  if (!customerId) {
    if (!/^01\d{8,9}$/.test(phone)) return { error: "휴대폰 번호를 확인하세요.", success: null };
    const { data } = await supabase.from("customers").select("id").eq("store_id", store.id).eq("phone", phone).maybeSingle();
    if (!data) return { error: "이 매장에서 구매한 적이 없는 번호예요.", success: null };
    customerId = data.id;
  }

  const { data, error } = await supabase.rpc("point_adjust", {
    p_customer_id: customerId,
    p_amount: direction === "sub" ? -amount : amount,
    p_memo: memo,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/points");
  revalidatePath(`/customers/${customerId}`);
  const done = Number(data);
  return {
    error: null,
    success: done > 0 ? `${done.toLocaleString()}점을 지급했어요.` : `${Math.abs(done).toLocaleString()}점을 차감했어요.`,
  };
}

export type ResetPinState = { error: string | null; success: string | null };

/**
 * 포인트 비밀번호 분실 → 관리자 초기화. 손님은 다음에 포인트를 쓸 때 새 비밀번호를 정한다(포인트는 그대로).
 * 남이 번호를 대고 초기화해 포인트를 빼 쓰는 걸 막으려고 "본인 확인" 체크를 받는다.
 * 누가·언제 했는지는 customers.point_pin_reset_at/by에 남는다.
 */
export async function resetPointPin(_prev: ResetPinState, formData: FormData): Promise<ResetPinState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };
  if (formData.get("confirmed") !== "on") {
    return { error: "손님 본인인지 확인했는지 체크해 주세요.", success: null };
  }

  let customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) {
    const phone = String(formData.get("phone") ?? "").replace(/[^0-9]/g, "");
    if (!/^01\d{8,9}$/.test(phone)) return { error: "휴대폰 번호를 확인하세요.", success: null };
    const { data } = await supabase.from("customers").select("id").eq("store_id", store.id).eq("phone", phone).maybeSingle();
    if (!data) return { error: "이 매장에서 구매한 적이 없는 번호예요.", success: null };
    customerId = data.id;
  }

  const { error } = await supabase.rpc("point_reset_pin", { p_customer_id: customerId });
  if (error) return { error: error.message, success: null };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/points");
  return { error: null, success: "비밀번호를 초기화했어요. 손님이 다음에 포인트를 쓸 때 새 비밀번호 4자리를 정하면 돼요." };
}
