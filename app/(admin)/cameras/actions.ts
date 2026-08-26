"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export async function createCamera(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const name = String(formData.get("name") ?? "").trim();
  const stream_url = String(formData.get("stream_url") ?? "").trim() || null;
  if (!name) return;

  await supabase.from("cameras").insert({ store_id: store.id, name, stream_url });
  revalidatePath("/cameras");
  revalidatePath("/dashboard");
}

export async function updateCamera(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  const stream_url = String(formData.get("stream_url") ?? "").trim() || null;
  if (!name) return;

  await supabase.from("cameras").update({ name, stream_url }).eq("id", id);
  revalidatePath("/cameras");
  revalidatePath("/dashboard");
}

export async function deleteCamera(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("cameras").delete().eq("id", id);
  revalidatePath("/cameras");
  revalidatePath("/dashboard");
}
