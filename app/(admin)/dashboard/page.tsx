import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import type { Product } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .order("stock_qty", { ascending: true });

  const products = (data ?? []) as Product[];
  const lowStock = products.filter((p) => p.stock_qty <= p.low_stock_threshold);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">대시보드</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <p className="text-xs text-zinc-500">재고부족 상품</p>
        <p className="text-lg font-semibold text-zinc-900">{lowStock.length}개</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">
          재고부족 상품 목록
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">상품명</th>
                <th className="px-3 py-2">바코드</th>
                <th className="px-3 py-2">현재 재고</th>
                <th className="px-3 py-2">기준</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-zinc-500">{p.barcode}</td>
                  <td className="px-3 py-2 font-medium text-red-600">
                    {p.stock_qty}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {p.low_stock_threshold}
                  </td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                    재고 부족 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
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
