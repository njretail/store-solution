import { requireProfile, getCurrentStore } from "@/lib/session";
import ExpiryForm from "./ExpiryForm";

type RecentExpiry = {
  id: string;
  expiry_date: string;
  quantity: number;
  created_at: string;
  products: { name: string; barcode: string } | null;
};

export default async function ExpiryPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("product_expiries")
    .select("id, expiry_date, quantity, created_at, products(name, barcode)")
    .eq("store_id", store.id)
    .order("expiry_date", { ascending: true })
    .limit(30);

  const recent = (data ?? []) as unknown as RecentExpiry[];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">소비기한 등록</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <ExpiryForm storeId={store.id} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">
          등록된 소비기한 목록
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">소비기한</th>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">바코드</th>
                <th className="px-4 py-3">수량</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => {
                const urgent = r.expiry_date <= todayStr;
                return (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td
                      className={`px-4 py-3 font-medium ${urgent ? "text-red-600" : "text-zinc-900"}`}
                    >
                      {r.expiry_date}
                    </td>
                    <td className="px-4 py-3">{r.products?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {r.products?.barcode ?? "-"}
                    </td>
                    <td className="px-4 py-3">{r.quantity}</td>
                  </tr>
                );
              })}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    등록된 소비기한 정보가 없습니다.
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
