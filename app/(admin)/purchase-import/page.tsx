import { requireAdmin, getCurrentStore } from "@/lib/session";
import PurchaseImportForm from "./PurchaseImportForm";
import type { Product } from "@/lib/types";

export default async function PurchaseImportPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .order("name");

  const products = (data ?? []) as Product[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">매입 등록(쿠팡)</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        쿠팡에서 다운로드한 거래명세표 PDF를 올리면 상품명/수량/거래액을 읽어서
        낱개수량·매입단가·판매단가를 자동 계산해드려요. 신규 상품은 바코드를
        입력해야 등록되고, 이미 등록된 상품이면 &ldquo;기존 상품 매칭&rdquo;으로
        바꿔서 입고만 반영할 수 있어요. 등록 전에 표에서 값을 확인/수정할 수
        있습니다.
      </p>

      <PurchaseImportForm
        marginPercent={store.default_margin_percent}
        products={products}
      />
    </div>
  );
}
