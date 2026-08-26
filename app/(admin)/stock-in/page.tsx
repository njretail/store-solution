import { requireProfile, getCurrentStore } from "@/lib/session";
import StockInForm from "./StockInForm";

type RecentStockIn = {
  id: string;
  quantity: number;
  unit_cost: number | null;
  memo: string | null;
  created_at: string;
  products: { name: string } | null;
};

export default async function StockInPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("stock_ins")
    .select("id, quantity, unit_cost, memo, created_at, products(name)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const recent = (data ?? []) as unknown as RecentStockIn[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">입고</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <StockInForm storeId={store.id} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">최근 입고 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-base">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">일시</th>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">수량</th>
                <th className="px-3 py-2">단가</th>
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
                  <td className="px-3 py-2">{r.quantity}</td>
                  <td className="px-3 py-2">{r.unit_cost ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.memo ?? "-"}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                    입고 내역이 없습니다.
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
