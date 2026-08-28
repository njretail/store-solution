import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";

type Grade = "A" | "B" | "C";

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-zinc-100 text-zinc-600",
};

export default async function LowStockProductsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);

  type ProductRow = {
    id: string;
    barcode: string;
    name: string;
    stock_qty: number;
    low_stock_threshold: number;
    categories: { name: string } | null;
  };

  const [productsData, { data: stockInData }, { data: rankData }] =
    await Promise.all([
      // 상품이 1000개를 넘는 매장에서 뒤쪽 상품이 누락되지 않도록 range()로 전부 가져온다.
      fetchAllPages<ProductRow>((from2, to) =>
        supabase
          .from("products")
          .select("id, barcode, name, stock_qty, low_stock_threshold, categories(name)")
          .eq("store_id", store.id)
          .range(from2, to)
          .then((res) => ({ data: res.data as unknown as ProductRow[] | null, error: res.error }))
      ),
      supabase.from("stock_ins").select("product_id").eq("store_id", store.id),
      supabase.rpc("top_products", {
        p_store_id: store.id,
        p_from: from.toISOString(),
        p_to: now.toISOString(),
        p_limit: 100000,
      }),
    ]);

  // 취급상품 = 한 번이라도 실제 입고 기록이 있는 상품. 대량 카탈로그 등록으로 들어왔지만
  // 아직 이 매장에서 실제로 다루지 않는(입고한 적 없는) 상품은 미취급으로 보고 제외한다.
  const carriedIds = new Set((stockInData ?? []).map((s) => s.product_id));

  // 최근 30일 판매금액 기준 ABC 등급(파레토 80/95) — 발주 우선순위 판단용.
  const ranked = ((rankData ?? []) as Array<{ product_id: string; revenue: number }>).sort(
    (a, b) => b.revenue - a.revenue
  );
  const totalRevenue = ranked.reduce((sum, r) => sum + r.revenue, 0);
  const gradeMap = new Map<string, Grade>();
  let cumulative = 0;
  for (const r of ranked) {
    cumulative += r.revenue;
    const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
    gradeMap.set(r.product_id, pct <= 80 ? "A" : pct <= 95 ? "B" : "C");
  }

  type Row = {
    id: string;
    barcode: string;
    name: string;
    category: string | null;
    stock_qty: number;
    low_stock_threshold: number;
    grade: Grade | null;
  };

  const rows: Row[] = productsData
    .filter((p) => p.stock_qty <= p.low_stock_threshold && carriedIds.has(p.id))
    .map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      category: p.categories?.name ?? null,
      stock_qty: p.stock_qty,
      low_stock_threshold: p.low_stock_threshold,
      grade: gradeMap.get(p.id) ?? null,
    }))
    .sort((a, b) => {
      const order = { A: 0, B: 1, C: 2 } as const;
      const ga = a.grade ? order[a.grade] : 3;
      const gb = b.grade ? order[b.grade] : 3;
      if (ga !== gb) return ga - gb;
      return a.stock_qty - b.stock_qty;
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          재고소진상품 ({rows.length}개)
        </h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        적정재고(재고부족 기준) 이하로 떨어진 상품 중, 실제로 이 매장에서 입고한
        적이 있는(취급 중인) 상품만 보여드려요. 등급은 최근 30일 매출 기준
        파레토 분석(A: 상위 80%, B: 다음 15%, C: 나머지)으로 계산되며, A등급이
        가장 빨리 발주해야 하는 상품이에요.
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">등급</th>
              <th className="px-4 py-3">상품명</th>
              <th className="px-4 py-3">바코드</th>
              <th className="px-4 py-3">분류</th>
              <th className="px-4 py-3">현재 재고</th>
              <th className="px-4 py-3">기준</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  {r.grade ? (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${GRADE_STYLE[r.grade]}`}
                    >
                      {r.grade}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">판매이력 없음</span>
                  )}
                </td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 text-zinc-500">{r.barcode}</td>
                <td className="px-4 py-3 text-zinc-500">{r.category ?? "-"}</td>
                <td className="px-4 py-3 font-medium text-red-600">
                  {r.stock_qty}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {r.low_stock_threshold}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  재고 부족 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-400">
        재고 기준치는{" "}
        <Link href="/products" className="text-[#C8075F] underline">
          상품 조회
        </Link>
        에서 상품별로 조정할 수 있습니다.
      </p>
    </div>
  );
}
