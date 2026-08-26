"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export type ProductFormState = { error: string | null; success: string | null };

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const barcode = String(formData.get("barcode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!barcode || !name) {
    return { error: "바코드와 상품명을 입력하세요.", success: null };
  }

  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_tax_exempt = formData.get("is_tax_exempt") === "true";
  const cost_price = Number(formData.get("cost_price") ?? 0) || 0;
  const sell_price = Number(formData.get("sell_price") ?? 0) || 0;
  const low_stock_threshold =
    Number(formData.get("low_stock_threshold") ?? 5) || 0;
  const initialQuantity = Number(formData.get("initial_quantity") ?? 0) || 0;

  const { data: created, error: insertError } = await supabase
    .from("products")
    .insert({
      store_id: store.id,
      barcode,
      name,
      category_id,
      is_tax_exempt,
      cost_price,
      sell_price,
      stock_qty: 0,
      low_stock_threshold,
    })
    .select()
    .single();

  if (insertError || !created) {
    const message = insertError?.message.includes("duplicate")
      ? "이미 등록된 바코드입니다."
      : (insertError?.message ?? "상품 등록에 실패했습니다.");
    return { error: message, success: null };
  }

  if (initialQuantity > 0) {
    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: created.id,
      p_quantity: initialQuantity,
      p_unit_cost: cost_price,
      p_memo: "최초 등록 입고",
    });
    if (stockInError) {
      return {
        error: `상품은 등록됐지만 입고 처리에 실패했습니다: ${stockInError.message}`,
        success: null,
      };
    }
  }

  revalidatePath("/products");
  revalidatePath("/stock-in");
  revalidatePath("/dashboard");
  return { error: null, success: `${name} 상품이 등록되었습니다.` };
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("categories").insert({ name });
  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_tax_exempt = formData.get("is_tax_exempt") === "true";
  const cost_price = Number(formData.get("cost_price") ?? 0) || 0;
  const sell_price = Number(formData.get("sell_price") ?? 0) || 0;
  const low_stock_threshold =
    Number(formData.get("low_stock_threshold") ?? 0) || 0;
  if (!name) return;

  await supabase
    .from("products")
    .update({
      name,
      category_id,
      is_tax_exempt,
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
