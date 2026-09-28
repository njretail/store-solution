import { requireAdmin, getCurrentStore, getAccessibleStores } from "@/lib/session";
import ProductBulkForm from "./ProductBulkForm";

export default async function ProductBulkPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;
  const stores = await getAccessibleStores(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 일괄 등록</h1>
        <p className="text-sm text-zinc-500">
          본사가 상품 정보를 엑셀로 한 번에 등록하는 화면이에요. 여러 매장을 골라 한 번에
          넣을 수 있고, 카테고리는 공용 목록이라 없는 이름은 자동으로 만들어져요.
        </p>
      </div>

      <ProductBulkForm stores={stores} currentStoreId={store.id} />
    </div>
  );
}
