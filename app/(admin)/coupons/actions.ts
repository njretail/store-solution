"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export async function createCoupon(formData: FormData) {
  const { supabase } = await requireAdmin();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discount_type = String(formData.get("discount_type") ?? "amount");
  const discount_value = Number(formData.get("discount_value") ?? 0) || 0;
  if (!code || discount_value <= 0) return;

  await supabase.from("coupons").insert({
    code,
    discount_type,
    discount_value,
  });

  revalidatePath("/coupons");
}

export async function toggleCoupon(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await supabase.from("coupons").update({ active: !active }).eq("id", id);
  revalidatePath("/coupons");
}

export async function deleteCoupon(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("coupons").delete().eq("id", id);
  revalidatePath("/coupons");
}
