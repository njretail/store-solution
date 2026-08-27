"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadProductImage(productId: string, file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지 용량은 5MB 이하로 올려주세요.");
  }
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${productId}-${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);

  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

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
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;

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

  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const image_url = await uploadProductImage(created.id, imageFile);
      await supabase.from("products").update({ image_url }).eq("id", created.id);
    } catch (e) {
      return {
        error: `상품은 등록됐지만 ${e instanceof Error ? e.message : "이미지 업로드에 실패했습니다."}`,
        success: null,
      };
    }
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

    if (expiryDate) {
      const { error: expiryError } = await supabase
        .from("product_expiries")
        .insert({
          store_id: store.id,
          product_id: created.id,
          expiry_date: expiryDate,
          quantity: initialQuantity,
        });
      if (expiryError) {
        return {
          error: `상품/입고는 등록됐지만 소비기한 등록에 실패했습니다: ${expiryError.message}`,
          success: null,
        };
      }
    }
  }

  revalidatePath("/products");
  revalidatePath("/stock-in");
  revalidatePath("/expiry");
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

export async function updateProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다.", success: null };

  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_tax_exempt = formData.get("is_tax_exempt") === "true";
  const cost_price = Number(formData.get("cost_price") ?? 0) || 0;
  const sell_price = Number(formData.get("sell_price") ?? 0) || 0;
  const low_stock_threshold =
    Number(formData.get("low_stock_threshold") ?? 0) || 0;
  const stockInput = formData.get("stock_qty");
  if (!name) return { error: "상품명을 입력하세요.", success: null };

  const updatePayload: Record<string, unknown> = {
    name,
    category_id,
    is_tax_exempt,
    cost_price,
    sell_price,
    low_stock_threshold,
    updated_at: new Date().toISOString(),
  };

  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      updatePayload.image_url = await uploadProductImage(id, imageFile);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "이미지 업로드에 실패했습니다.",
        success: null,
      };
    }
  }

  // 실재고 입력값이 기존 재고보다 늘었으면 입고(record_stock_in)로 처리해서
  // 입고내역 감사로그가 남고, 재고소진상품의 "취급 중" 판정에도 반영되게 한다.
  // 줄었을 경우(실사 후 하향 조정)만 직접 수정한다.
  if (stockInput !== null) {
    const newStock = Number(stockInput);
    if (!Number.isNaN(newStock) && newStock >= 0) {
      const { data: current } = await supabase
        .from("products")
        .select("stock_qty")
        .eq("id", id)
        .single();
      const currentStock = current?.stock_qty ?? 0;
      const delta = newStock - currentStock;

      if (delta > 0) {
        const { error: stockInError } = await supabase.rpc("record_stock_in", {
          p_product_id: id,
          p_quantity: delta,
          p_memo: "실재고 반영",
        });
        if (stockInError) {
          return { error: stockInError.message, success: null };
        }
      } else if (delta < 0) {
        updatePayload.stock_qty = newStock;
      }
    }
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id);
  if (error) return { error: error.message, success: null };

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/products/low-stock");
  return { error: null, success: "저장되었습니다." };
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/products");
  revalidatePath("/products/low-stock");
  redirect("/products");
}
