"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BGM_BYTES = 25 * 1024 * 1024;

export type KioskBgmState = { error: string | null; success: string | null };

export async function uploadKioskBgm(
  _prevState: KioskBgmState,
  formData: FormData
): Promise<KioskBgmState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const kiosk_id = String(formData.get("kiosk_id") ?? "") || null;
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "음악 파일을 선택하세요.", success: null };
  }
  if (file.size > MAX_BGM_BYTES) {
    return { error: "음악 파일은 25MB 이하로 올려주세요(mp3 권장).", success: null };
  }
  const title = String(formData.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const path = `kiosk-bgm/${store.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) return { error: `업로드 실패: ${uploadError.message}`, success: null };
  const { data } = admin.storage.from("product-images").getPublicUrl(path);

  const { error } = await supabase.from("kiosk_bgm_tracks").insert({
    store_id: store.id,
    kiosk_id,
    title,
    audio_url: data.publicUrl,
    created_by: profile.id,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/kiosks/bgm");
  return { error: null, success: `"${title}" 곡이 등록되었습니다.` };
}

export async function updateKioskBgmSettings(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const volume = Math.min(100, Math.max(0, Number(formData.get("bgm_volume") ?? 40) || 0));
  await supabase
    .from("stores")
    .update({ bgm_enabled: formData.get("bgm_enabled") === "on", bgm_volume: volume })
    .eq("id", store.id);
  revalidatePath("/kiosks/bgm");
}

export async function updateKioskBgmOrder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase
    .from("kiosk_bgm_tracks")
    .update({ sort_order: Number(formData.get("sort_order") ?? 0) || 0 })
    .eq("id", id);
  revalidatePath("/kiosks/bgm");
}

export async function toggleKioskBgmActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  await supabase.from("kiosk_bgm_tracks").update({ active: !active }).eq("id", id);
  revalidatePath("/kiosks/bgm");
}

export async function deleteKioskBgm(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("kiosk_bgm_tracks").delete().eq("id", id);
  revalidatePath("/kiosks/bgm");
}
