"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, getCurrentStore } from "@/lib/session";

export type ChangeTransferState = { error: string | null; success: string | null };

export async function createChangeTransferRequest(
  _prevState: ChangeTransferState,
  formData: FormData
): Promise<ChangeTransferState> {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const customer_name = String(formData.get("customer_name") ?? "").trim() || null;
  const customer_phone = String(formData.get("customer_phone") ?? "").trim() || null;
  const bank_name = String(formData.get("bank_name") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  const account_holder = String(formData.get("account_holder") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!bank_name || !account_number || !account_holder) {
    return { error: "은행명 · 계좌번호 · 예금주를 입력하세요.", success: null };
  }
  if (!amount || amount <= 0) {
    return { error: "이체할 금액을 확인하세요.", success: null };
  }

  const { error } = await supabase.from("change_transfer_requests").insert({
    store_id: store.id,
    customer_name,
    customer_phone,
    bank_name,
    account_number,
    account_holder,
    amount,
    memo,
    requested_by: profile.id,
  });

  if (error) return { error: error.message, success: null };

  revalidatePath("/change-transfers");
  return { error: null, success: "계좌이체 요청이 등록되었습니다." };
}

// pending 상태에서만 지급완료/지급취소로 전환할 수 있다(둘 다 그 뒤로는 되돌리지 않는
// 종결 상태) — eq("status","pending")으로 이미 처리된 건을 실수로 다시 바꾸는 것을 막는다.
export async function setChangeTransferStatus(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "paid" && status !== "cancelled")) return;

  const update: Record<string, unknown> =
    status === "paid"
      ? { status, paid_at: new Date().toISOString(), paid_by: profile.id }
      : { status };

  await supabase
    .from("change_transfer_requests")
    .update(update)
    .eq("id", id)
    .eq("status", "pending");

  revalidatePath("/change-transfers");
}
