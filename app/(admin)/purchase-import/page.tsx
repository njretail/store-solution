import { requireAdmin, getCurrentStore } from "@/lib/session";
import PurchaseImportForm from "./PurchaseImportForm";

export default async function PurchaseImportPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  // 매칭 드롭다운에는 이름/바코드만 필요하므로 전체 컬럼을 보내지 않는다
  // (상품이 많아지면 전체 컬럼 전송이 페이지 로딩을 눈에 띄게 늦춘다).
  const { data } = await supabase
    .from("products")
    .select("id, name, barcode")
    .eq("store_id", store.id)
    .order("name");

  const products = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">매입 등록(쿠팡)</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        쿠팡에서 다운로드한 거래명세표 PDF를 올리면 상품명/수량/거래액을 읽어서
        낱개수량·매입단가·판매단가를 자동 계산해드려요. 이미 등록된 상품과
        이름이 비슷하면 자동으로 매칭돼서 &ldquo;기존 상품 매칭&rdquo;으로
        표시되고(초록색 ✓ 표시), 매칭되지 않은 신규 상품만 바코드를 입력하면
        돼요. 등록 전에 표에서 값과 매칭 결과를 확인/수정할 수 있습니다.
      </p>

      <PurchaseImportForm
        marginPercent={store.default_margin_percent}
        products={products}
      />
    </div>
  );
}
