"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import type { ControlLevel } from "@/lib/control-settings";

function isControlLevel(v: unknown): v is ControlLevel {
  return v === "hq_fixed" || v === "hq_default_store_adjust" || v === "store_free";
}

// 전체 기본 / 직영점 / 가맹점 / 개별 매장 중 하나의 통제수준을 저장한다. 빈 값을
// 고르면 그 범위의 설정을 지워서 상위 범위(매장유형 → 전체 → 기본값인 점포자율)를
// 따르게 한다. scope_value는 global이면 빈 문자열, store_type이면 'direct'/'franchise',
// store면 매장 id다.
export async function setControlLevel(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const settingKey = String(formData.get("setting_key") ?? "");
  const scopeType = String(formData.get("scope_type") ?? "");
  const scopeValue = String(formData.get("scope_value") ?? "");
  const controlLevel = String(formData.get("control_level") ?? "");

  if (!settingKey || !["global", "store_type", "store"].includes(scopeType)) return;

  if (!controlLevel) {
    await supabase
      .from("control_settings")
      .delete()
      .eq("setting_key", settingKey)
      .eq("scope_type", scopeType)
      .eq("scope_value", scopeValue);
    revalidatePath("/control-settings");
    return;
  }

  if (!isControlLevel(controlLevel)) return;

  await supabase.from("control_settings").upsert(
    {
      setting_key: settingKey,
      scope_type: scopeType,
      scope_value: scopeValue,
      control_level: controlLevel,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key,scope_type,scope_value" }
  );

  revalidatePath("/control-settings");
}

export async function removeControlSetting(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("control_settings").delete().eq("id", id);
  revalidatePath("/control-settings");
}

export async function setStoreType(formData: FormData) {
  const { supabase } = await requireAdmin();
  const storeId = String(formData.get("store_id") ?? "");
  const storeType = String(formData.get("store_type") ?? "");
  if (!storeId || !["direct", "franchise"].includes(storeType)) return;

  await supabase.from("stores").update({ store_type: storeType }).eq("id", storeId);
  revalidatePath("/control-settings");
}
