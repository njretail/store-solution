"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export async function createProduct(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const barcode = String(formData.get("barcode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!barcode || !name) return;

  const category = String(formData.get("category") ?? "").trim() || null;
  const cost_price = Number(formData.get("cost_price") ?? 0) || 0;
  const sell_price = Number(formData.get("sell_price") ?? 0) || 0;
  const stock_qty = Number(formData.get("stock_qty") ?? 0) || 0;
  const low_stock_threshold = Number(formData.get("low_stock_threshold") ?? 5) || 0;

  await supabase.from("products").insert({
    store_id: store.id,
    barcode,
    name,
    category,
    cost_price,
    sell_price,
    stock_qty,
    low_stock_threshold,
  });

  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const cost_price = Number(formData.get("cost_price") ?? 0) || 0;
  const sell_price = Number(formData.get("sell_price") ?? 0) || 0;
  const low_stock_threshold = Number(formData.get("low_stock_threshold") ?? 0) || 0;
  if (!name) return;

  await supabase
    .from("products")
    .update({
      name,
      category,
      cost_price,
      sell_price,
      low_stock_threshold,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/products");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/products");
}
