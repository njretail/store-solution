"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCurrentStoreIdCookie } from "@/lib/current-store";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function switchStore(formData: FormData) {
  const storeId = String(formData.get("store_id") ?? "");
  if (storeId) {
    await setCurrentStoreIdCookie(storeId);
  }
  revalidatePath("/", "layout");
}

export async function addStore(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({ name, address })
    .select()
    .single();

  if (!error && data) {
    await setCurrentStoreIdCookie(data.id);
  }
  revalidatePath("/", "layout");
}
