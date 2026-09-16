"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export type CategoryState = { error: string | null; success: string | null };

export async function createCategory(
  _prevState: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "카테고리 이름을 입력하세요.", success: null };

  const { error } = await supabase.from("categories").insert({ name });
  if (error) {
    const message = error.code === "23505" ? "이미 있는 카테고리 이름입니다." : error.message;
    return { error: message, success: null };
  }

  revalidatePath("/categories");
  revalidatePath("/products");
  return { error: null, success: `"${name}" 카테고리를 추가했습니다.` };
}

export async function renameCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await supabase.from("categories").update({ name }).eq("id", id);
  revalidatePath("/categories");
  revalidatePath("/products");
}

export type DeleteCategoryState = { error: string | null };

// 상품이 아직 이 카테고리를 쓰고 있으면 categories.id를 참조하는 외래키 제약 때문에
// 삭제가 거부된다 — 그 경우 몇 개 상품이 쓰고 있는지 알려줘서 먼저 상품들을
// 다른 카테고리로 옮기거나 삭제하도록 안내한다.
export async function deleteCategory(
  _prevState: DeleteCategoryState,
  formData: FormData
): Promise<DeleteCategoryState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: null };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);
      return {
        error: `이 카테고리를 쓰는 상품이 ${count ?? 0}개 있어 삭제할 수 없습니다. 먼저 해당 상품들의 분류를 바꿔주세요.`,
      };
    }
    return { error: error.message };
  }

  revalidatePath("/categories");
  revalidatePath("/products");
  return { error: null };
}
