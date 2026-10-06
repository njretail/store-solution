"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_AD_IMAGE_BYTES = 8 * 1024 * 1024;

export type KioskAdState = { error: string | null; success: string | null };

export async function uploadKioskAd(
  _prevState: KioskAdState,
  formData: FormData
): Promise<KioskAdState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const kiosk_id = String(formData.get("kiosk_id") ?? "") || null;
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "이미지 파일을 선택하세요.", success: null };
  }
  if (file.size > MAX_AD_IMAGE_BYTES) {
    return { error: "이미지 용량은 8MB 이하로 올려주세요.", success: null };
  }

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `kiosk-ads/${store.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) {
    return { error: `업로드 실패: ${uploadError.message}`, success: null };
  }
  const { data } = admin.storage.from("product-images").getPublicUrl(path);

  const { error } = await supabase.from("kiosk_ads").insert({
    store_id: store.id,
    kiosk_id,
    image_url: data.publicUrl,
    created_by: profile.id,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/kiosks/ads");
  return { error: null, success: "광고 이미지가 등록되었습니다." };
}

export async function toggleKioskAdActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await supabase.from("kiosk_ads").update({ active: !active }).eq("id", id);
  revalidatePath("/kiosks/ads");
}

export async function deleteKioskAd(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("kiosk_ads").delete().eq("id", id);
  revalidatePath("/kiosks/ads");
}
