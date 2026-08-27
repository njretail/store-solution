import { notFound } from "next/navigation";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import EditProductForm from "./EditProductForm";
import type { Category, Product } from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { id } = await params;

  const [{ data: product }, { data: categoriesData }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase.from("categories").select("*").order("name"),
  ]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 수정</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <EditProductForm
        product={product as Product}
        categories={(categoriesData ?? []) as Category[]}
      />
    </div>
  );
}
