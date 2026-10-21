"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import type { CustomerVoiceStatus } from "@/lib/types";

const STATUSES: CustomerVoiceStatus[] = ["new", "reviewed", "done"];

// 고객의 소리 처리 상태(새 의견 → 확인함 → 반영 완료)와 관리자 메모를 함께 저장한다.
// 매장 범위는 RLS가 막는다(staff는 자기 매장 것만 update 가능).
export async function updateCustomerVoice(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as CustomerVoiceStatus;
  const admin_note = String(formData.get("admin_note") ?? "").trim().slice(0, 300) || null;
  if (!id || !STATUSES.includes(status)) return;

  const update: Record<string, unknown> =
    status === "new"
      ? { status, admin_note, handled_by: null, handled_at: null }
      : { status, admin_note, handled_by: profile.id, handled_at: new Date().toISOString() };

  await supabase.from("customer_voices").update(update).eq("id", id);
  revalidatePath("/customer-voice");
}
