"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export type AnnouncementState = { error: string | null; success: string | null };

export async function createAnnouncement(
  _prevState: AnnouncementState,
  formData: FormData
): Promise<AnnouncementState> {
  const { supabase, profile } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력하세요.", success: null };
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    created_by: profile.id,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { error: null, success: "공지사항을 등록했습니다." };
}

export async function deleteAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("announcements").delete().eq("id", id);
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}
