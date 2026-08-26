import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import type { Product } from "@/lib/types";

function todayRangeIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { fromIso, toIso } = todayRangeIso();

  const [{ data: productsData }, { data: salesData }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .order("stock_qty", { ascending: true }),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
  ]);

  const products = (productsData ?? []) as Product[];
  const lowStock = products.filter((p) => p.stock_qty <= p.low_stock_threshold);

  const todaySales = salesData ?? [];
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total_amount, 0);
  const todayCount = todaySales.length;
  const todayAvg = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">홈</h1>
        <p className="text-base text-zinc-500">{store.name}</p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          오늘 매출
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">오늘 매출</p>
            <p className="text-3xl font-semibold text-zinc-900">
              {todayRevenue.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">오늘 판매 건수</p>
            <p className="text-3xl font-semibold text-zinc-900">
              {todayCount}건
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">건당 평균</p>
            <p className="text-3xl font-semibold text-zinc-900">
              {todayAvg.toLocaleString()}원
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          더 자세한 기간별 매출은{" "}
          <Link href="/sales" className="underline">
            매출조회
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          재고부족 상품 ({lowStock.length}개)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">바코드</th>
                <th className="px-4 py-3">현재 재고</th>
                <th className="px-4 py-3">기준</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.barcode}</td>
                  <td className="px-4 py-3 font-medium text-red-600">
                    {p.stock_qty}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.low_stock_threshold}
                  </td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    재고 부족 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          재고 기준치는{" "}
          <Link href="/products" className="underline">
            상품관리
          </Link>
          에서 상품별로 조정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
