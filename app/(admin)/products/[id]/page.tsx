import { notFound } from "next/navigation";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchControlSettings, resolveControlLevel } from "@/lib/control-settings";
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

  const [{ data: product }, { data: categoriesData }, controlSettings] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase.from("categories").select("*").order("name"),
    fetchControlSettings(supabase),
  ]);

  if (!product) notFound();

  // 정책 설정(2-1)에서 "① 본사 고정"으로 정해둔 항목은 개별 상품 수정 화면에서
  // 바꿀 수 없게 한다 — 공급가/판매가는 본사 일괄 등록(/products/bulk)으로만
  // 바꾸도록 채널을 분리한다(역할 분리 없이도 바로 적용 가능한 부분).
  const costLocked = resolveControlLevel(controlSettings, "supply_price", store) === "hq_fixed";
  const sellLocked = resolveControlLevel(controlSettings, "sell_price", store) === "hq_fixed";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 수정</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <EditProductForm
        product={product as Product}
        categories={(categoriesData ?? []) as Category[]}
        costLocked={costLocked}
        sellLocked={sellLocked}
      />
    </div>
  );
}
