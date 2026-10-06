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

export type AlertTestState = { error: string | null; success: string | null };

// 실제 센서/보안 장비가 연동되기 전까지, 관리자가 직접 울려보고 배너·흐름이
// 제대로 작동하는지 확인해볼 수 있는 테스트 트리거. 에러를 화면에 보여줘야
// "마이그레이션이 아직 안 돌아서 테이블이 없다" 같은 상황을 바로 알 수 있다
// (예전엔 에러를 그냥 삼켜서 눌러도 아무 일도 안 일어나는 것처럼 보였음).
export async function createTestUrgentAlert(
  _prevState: AlertTestState,
  formData: FormData
): Promise<AlertTestState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const type = String(formData.get("type") ?? "other") as UrgentAlertType;

  const { error } = await supabase.from("urgent_alerts").insert({
    store_id: store.id,
    type,
    message: "[테스트] 관리자가 직접 발생시킨 테스트 알림입니다.",
    source: "관리자 테스트",
  });

  if (error) {
    return { error: `알림 생성 실패: ${error.message}`, success: null };
  }

  revalidatePath("/dashboard");
  revalidatePath("/daily-report");
  return { error: null, success: "테스트 알림을 보냈습니다 — 15초 안에 화면 위쪽에 빨간 배너로 떠요." };
}
