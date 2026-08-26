import { requireAdmin, getCurrentStore } from "@/lib/session";
import ProductForm from "../ProductForm";
import type { Category } from "@/lib/types";

export default async function ProductNewPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase.from("categories").select("*").order("name");
  const categories = (data ?? []) as Category[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 추가</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
