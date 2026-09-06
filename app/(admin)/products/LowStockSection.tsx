import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { Store } from "@/lib/types";
import { syncAutoOrderEnabled } from "./actions";
import ProductOrderCell from "./ProductOrderCell";
import SelectAllCheckbox from "./SelectAllCheckbox";

type Grade = "A" | "B" | "C";

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-zinc-100 text-zinc-600",
};

// 상품 조회 화면의 "재고소진상품만 보기" 탭에서 쓰는 섹션. 원래 별도 페이지였던
// /products/low-stock의 내용을 그대로 옮겨와 상품 조회 안에서 렌더링한다.
export default async function LowStockSection({
  supabase,
  store,
}: {
  supabase: SupabaseClient;
  store: Store;
}) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);

  type ProductRow = {
    id: string;
    barcode: string;
    name: string;
    stock_qty: number;
    low_stock_threshold: number;
    auto_order_enabled: boolean;
    categories: { name: string } | null;
  };

  const [productsData, { data: stockInData }, { data: rankData }] = await Promise.all([
    // 상품이 1000개를 넘는 매장에서 뒤쪽 상품이 누락되지 않도록 range()로 전부 가져온다.
    fetchAllPages<ProductRow>((from2, to) =>
      supabase
        .from("products")
        .select(
          "id, barcode, name, stock_qty, low_stock_threshold, auto_order_enabled, categories(name)"
        )
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

  // 최근 30일 매출금액 기준 ABC 등급(파레토 80/95) — 발주 우선순위 판단용.
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
    auto_order_enabled: boolean;
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
      auto_order_enabled: p.auto_order_enabled,
      grade: gradeMap.get(p.id) ?? null,
    }))
    .sort((a, b) => {
      const order = { A: 0, B: 1, C: 2 } as const;
      const ga = a.grade ? order[a.grade] : 3;
      const gb = b.grade ? order[b.grade] : 3;
      if (ga !== gb) return ga - gb;
      return a.stock_qty - b.stock_qty;
    });

  // 분류별로 묶어서 보여준다 — 낱개로 쭉 나열하면 어떤 상품군이 부족한지 한눈에
  // 안 들어와서, 분류마다 소제목을 두고 그 안에 상품들을 표로 보여준다.
  const UNCATEGORIZED = "미분류";
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.category ?? UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const groupEntries = [...groups.entries()].sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b, "ko");
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-500">
        적정재고(재고부족 기준) 이하로 떨어진 상품 중, 실제로 이 매장에서 입고한
        적이 있는(취급 중인) 상품만 보여드려요. 등급은 최근 30일 매출 기준
        파레토 분석(A: 상위 80%, B: 다음 15%, C: 나머지)으로 계산되며, A등급이
        가장 빨리 발주해야 하는 상품이에요. 자동발주를 켜두면 재고가 기준 이하로
        떨어졌을 때 본부로 자동 발주돼요 — 진행 상황은{" "}
        <Link href="/purchase-orders" className="text-[#C8075F] underline">
          발주관리
        </Link>
        에서 확인하세요.
      </p>

      {/* 체크박스는 표 안에, form 태그는 밖에 두고 form="auto-order-form"으로 연결한다 —
          ProductOrderCell이 각 행 안에 자체 <form>(본부/쿠팡 발주)을 갖고 있어서
          표 전체를 <form>으로 감싸면 form 중첩(잘못된 HTML)이 되기 때문. */}
      <form id="auto-order-form" action={syncAutoOrderEnabled} />
      <div className="flex flex-col gap-6">
        {rows.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-zinc-500">
            <SelectAllCheckbox />
            분류 전체에서 자동발주 전체선택/해제
          </div>
        )}

        {groupEntries.map(([category, groupRows]) => (
          <div key={category} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-800">
              {category} <span className="text-sm font-normal text-zinc-400">({groupRows.length}개)</span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="w-full whitespace-nowrap text-base">
                <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">등급</th>
                    <th className="px-4 py-3">상품명</th>
                    <th className="px-4 py-3">현재 재고</th>
                    <th className="px-4 py-3">기준</th>
                    <th className="px-4 py-3">자동발주</th>
                    <th className="px-4 py-3">발주</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r) => (
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
                      <td className="px-4 py-3">
                        <div className="text-xs text-zinc-400">{r.barcode}</div>
                        <div>{r.name}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {r.stock_qty}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {r.low_stock_threshold}
                      </td>
                      <td className="px-4 py-3">
                        <input type="hidden" form="auto-order-form" name="row_ids" value={r.id} />
                        <input
                          type="checkbox"
                          form="auto-order-form"
                          name="checked_ids"
                          value={r.id}
                          defaultChecked={r.auto_order_enabled}
                          data-auto-order-checkbox
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ProductOrderCell
                          productId={r.id}
                          productName={r.name}
                          lowStockThreshold={r.low_stock_threshold}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-zinc-400">
            재고 부족 상품이 없습니다.
          </div>
        )}

        {rows.length > 0 && (
          <button
            type="submit"
            form="auto-order-form"
            className="w-fit rounded-lg bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650]"
          >
            자동발주 설정 저장
          </button>
        )}
      </div>
    </div>
  );
}
