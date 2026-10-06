"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireAdmin, getCurrentStore } from "@/lib/session";
import type { UrgentAlertType } from "@/lib/types";

export async function resolveUrgentAlert(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("urgent_alerts")
    .update({ resolved: true, resolved_by: profile.id, resolved_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/dashboard");
}

// 실제 센서/보안 장비가 연동되기 전까지, 관리자가 직접 울려보고 배너·흐름이
// 제대로 작동하는지 확인해볼 수 있는 테스트 트리거.
export async function createTestUrgentAlert(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const type = String(formData.get("type") ?? "other") as UrgentAlertType;

  await supabase.from("urgent_alerts").insert({
    store_id: store.id,
    type,
    message: "[테스트] 관리자가 직접 발생시킨 테스트 알림입니다.",
    source: "관리자 테스트",
  });

  revalidatePath("/dashboard");
  revalidatePath("/daily-report");
}
