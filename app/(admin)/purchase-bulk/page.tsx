import { requireAdmin, getCurrentStore } from "@/lib/session";
import PurchaseImportForm from "@/app/components/PurchaseImportForm";
import { parseBulkExcel } from "./actions";

export default async function PurchaseBulkPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  // 매칭 드롭다운에는 이름/바코드만 필요하므로 전체 컬럼을 보내지 않는다.
  const { data } = await supabase
    .from("products")
    .select("id, name, barcode")
    .eq("store_id", store.id)
    .order("name");

  const products = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">대량매입</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        바코드번호/상품명/수량/거래액 컬럼이 있는 엑셀 파일을 올리면 낱개수량·매입단가·
        판매단가를 자동 계산해드려요. 바코드번호가 기존 상품과 일치하면 자동으로
        &ldquo;기존 상품 매칭&rdquo;으로 표시되고(초록색 ✓ 표시), 일치하지 않는 신규 상품은
        엑셀에 있던 바코드가 미리 채워진 채로 &ldquo;신규 등록&rdquo;으로 표시됩니다.
        등록 전에 표에서 값과 매칭 결과를 확인/수정할 수 있습니다.
      </p>

      <PurchaseImportForm
        marginPercent={store.default_margin_percent}
        products={products}
        parseAction={parseBulkExcel}
        parseInitial={{ error: null, rows: [] }}
        fileAccept=".xlsx,.xls"
        fileLabel="대량매입 엑셀"
      />
    </div>
  );
}
