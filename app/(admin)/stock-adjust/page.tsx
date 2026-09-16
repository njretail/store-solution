import { requireProfile, getCurrentStore } from "@/lib/session";
import StockAdjustForm from "./StockAdjustForm";
import { STOCK_ADJUSTMENT_REASON_LABELS, type StockAdjustmentReason } from "@/lib/types";

type RecentAdjustment = {
  id: string;
  quantity: number;
  reason: StockAdjustmentReason;
  memo: string | null;
  created_at: string;
  products: { name: string } | null;
};

export default async function StockAdjustPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("stock_adjustments")
    .select("id, quantity, reason, memo, created_at, products(name)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const recent = (data ?? []) as unknown as RecentAdjustment[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">재고조정</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
        <p className="mt-2 text-sm text-zinc-500">
          폐기·반품·분실 등으로 재고가 줄어든 상품을 바코드로 찾아 사유와 함께 기록하세요.
          입고와 반대 방향으로 재고에 즉시 반영됩니다.
        </p>
      </div>

      <StockAdjustForm storeId={store.id} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">최근 재고조정 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">일시</th>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">사유</th>
                <th className="px-3 py-2">수량</th>
                <th className="px-3 py-2">메모</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-500">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">{r.products?.name ?? "-"}</td>
                  <td className="px-3 py-2">{STOCK_ADJUSTMENT_REASON_LABELS[r.reason]}</td>
                  <td className="px-3 py-2 text-red-600">-{r.quantity}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.memo ?? "-"}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                    재고조정 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
