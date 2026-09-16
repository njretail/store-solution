"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export async function createKiosk(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("kiosks").insert({ store_id: store.id, name });
  revalidatePath("/kiosks");
}

export async function updateKioskStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "online");
  if (!id) return;

  await supabase
    .from("kiosks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/kiosks");
}

export async function updateKioskDisplay(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const notice_message = String(formData.get("notice_message") ?? "").trim() || null;
  const banner_message = String(formData.get("banner_message") ?? "").trim() || null;

  await supabase
    .from("kiosks")
    .update({ notice_message, banner_message })
    .eq("id", id);

  revalidatePath("/kiosks");
}

export async function deleteKiosk(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("kiosks").delete().eq("id", id);
  revalidatePath("/kiosks");
}
