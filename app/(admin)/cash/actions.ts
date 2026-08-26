"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireAdmin, getCurrentStore } from "@/lib/session";

export type CashState = { error: string | null; success: string | null };

export async function recordCashTransaction(
  _prevState: CashState,
  formData: FormData
): Promise<CashState> {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const type = String(formData.get("type") ?? "deposit");
  const amount = Number(formData.get("amount") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!amount || amount <= 0) {
    return { error: "금액을 확인하세요.", success: null };
  }

  const { error } = await supabase.from("cash_transactions").insert({
    store_id: store.id,
    type,
    amount,
    memo,
  });

  if (error) {
    return { error: error.message, success: null };
  }

  revalidatePath("/cash");
  revalidatePath("/dashboard");
  return {
    error: null,
    success: type === "deposit" ? "현금 투입이 등록되었습니다." : "현금 출금이 등록되었습니다.",
  };
}

export async function updateCashThreshold(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const raw = String(formData.get("cash_alert_threshold") ?? "").trim();
  const threshold = raw ? Number(raw) : null;

  await supabase
    .from("stores")
    .update({ cash_alert_threshold: threshold })
    .eq("id", store.id);

  revalidatePath("/cash");
  revalidatePath("/dashboard");
}
