"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export type KioskAnnouncementState = { error: string | null; success: string | null };

export async function createKioskAnnouncement(
  _prevState: KioskAnnouncementState,
  formData: FormData
): Promise<KioskAnnouncementState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const kiosk_id = String(formData.get("kiosk_id") ?? "") || null;
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "안내멘트 문구를 입력하세요.", success: null };

  let audio_url: string | null = null;
  const file = formData.get("audio");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AUDIO_BYTES) {
      return { error: "오디오 용량은 10MB 이하로 올려주세요.", success: null };
    }
    const admin = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const path = `kiosk-audio/${store.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (uploadError) return { error: `오디오 업로드 실패: ${uploadError.message}`, success: null };
    audio_url = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("kiosk_announcements").insert({
    store_id: store.id,
    kiosk_id,
    message,
    audio_url,
    created_by: profile.id,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/kiosks/announcements");
  return {
    error: null,
    success: audio_url
      ? "안내멘트가 등록되었습니다(업로드한 오디오 재생)."
      : "안내멘트가 등록되었습니다(브라우저 음성으로 읽어줌).",
  };
}

export async function toggleKioskAnnouncementActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await supabase.from("kiosk_announcements").update({ active: !active }).eq("id", id);
  revalidatePath("/kiosks/announcements");
}

export async function deleteKioskAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("kiosk_announcements").delete().eq("id", id);
  revalidatePath("/kiosks/announcements");
}
