import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { GRADE_STYLE } from "@/lib/grade";
import {
  buildProductRanking,
  buildCategoryBreakdown,
  buildDailyTrend,
  buildHourlyDistribution,
  findDeadStock,
  type SaleItemRow,
  type ProductInfo,
} from "@/lib/product-stats";
import StatsExcelButton from "./StatsExcelButton";

function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 순수 달력 날짜 문자열 연산(실제 시각/타임존과 무관) — "YYYY-MM-DD"를 UTC 자정으로
// 취급해 날짜만 더하고 뺀다. 실제 KST 자정 시각으로 변환하는 건 kstRangeIso가 따로 한다.
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 화면에서 다루는 from/to는 "KST 기준 날짜(YYYY-MM-DD, 양끝 포함)"이고, 서버는 UTC로
// 돌아가므로 쿼리용 경계는 KST 자정을 명시한 뒤 UTC로 변환해서 만든다.
function kstRangeIso(from: string, to: string) {
  const fromIso = new Date(`${from}T00:00:00+09:00`).toISOString();
  const toIso = new Date(`${addDaysStr(to, 1)}T00:00:00+09:00`).toISOString();
  return { fromIso, toIso };
}

type Preset = "today" | "week" | "month30" | "thisMonth" | "lastMonth" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  today: "오늘",
  week: "최근 7일",
  month30: "최근 30일",
  thisMonth: "이번달",
  lastMonth: "지난달",
  custom: "직접 설정",
};

function presetRange(preset: Preset): { from: string; to: string } {
  const today = kstTodayStr();
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: addDaysStr(today, -6), to: today };
  if (preset === "thisMonth") return { from: today.slice(0, 8) + "01", to: today };
  if (preset === "lastMonth") {
    const [y, m] = today.split("-").map(Number);
    const lastMonthEnd = addDaysStr(`${y}-${String(m).padStart(2, "0")}-01`, -1);
    const lastMonthStart = lastMonthEnd.slice(0, 8) + "01";
    return { from: lastMonthStart, to: lastMonthEnd };
  }
  return { from: addDaysStr(today, -29), to: today };
}

export default async function ProductStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const preset: Preset =
    params.preset === "today" ||
    params.preset === "week" ||
    params.preset === "thisMonth" ||
    params.preset === "lastMonth" ||
    params.preset === "custom"
      ? params.preset
      : "month30";
  const defaults = presetRange(preset === "custom" ? "month30" : preset);
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;
  const { fromIso, toIso } = kstRangeIso(from, to);

  const [items, products, { data: categoriesData }, salesInRange] = await Promise.all([
    fetchAllPages<SaleItemRow>((rangeFrom, rangeTo) =>
      supabase
        .from("sale_items")
        .select("product_id, quantity, subtotal, sales!inner(created_at, status)")
        .eq("store_id", store.id)
        .eq("sales.status", "completed")
        .gte("sales.created_at", fromIso)
        .lt("sales.created_at", toIso)
        .range(rangeFrom, rangeTo)
        .then((res) => ({
          data:
            (res.data as unknown as Array<{
              product_id: string;
              quantity: number;
              subtotal: number;
              sales: { created_at: string } | { created_at: string }[];
            }> | null)?.map((row) => ({
              product_id: row.product_id,
              quantity: row.quantity,
              subtotal: row.subtotal,
              created_at: Array.isArray(row.sales) ? row.sales[0]?.created_at : row.sales.created_at,
            })) ?? null,
          error: res.error,
        }))
    ),
    fetchAllPages<ProductInfo>((rangeFrom, rangeTo) =>
      supabase
        .from("products")
        .select("id, name, category_id, stock_qty")
        .eq("store_id", store.id)
        .range(rangeFrom, rangeTo)
    ),
    supabase.from("categories").select("id, name").order("name"),
    fetchAllPages<{ id: string; total_amount: number }>((rangeFrom, rangeTo) =>
      supabase
        .from("sales")
        .select("id, total_amount")
        .eq("store_id", store.id)
        .eq("status", "completed")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .range(rangeFrom, rangeTo)
    ),
  ]);

  const categories = new Map((categoriesData ?? []).map((c) => [c.id, c.name]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const ranking = buildProductRanking(items, productMap, categories);
  const categoryBreakdown = buildCategoryBreakdown(ranking);
  const dailyTrend = buildDailyTrend(items, fromIso, toIso);
  const hourlyDistribution = buildHourlyDistribution(items);
  const soldProductIds = new Set(ranking.map((r) => r.product_id));
  const deadStock = findDeadStock(products, categories, soldProductIds);

  const totalRevenue = salesInRange.reduce((sum, s) => sum + s.total_amount, 0);
  const saleCount = salesInRange.length;
  const avgPerSale = saleCount > 0 ? Math.round(totalRevenue / saleCount) : 0;
  const maxDailyRevenue = Math.max(...dailyTrend.map((d) => d.revenue), 1);
  const maxHourlyRevenue = Math.max(...hourlyDistribution.map((h) => h.revenue), 1);
  const maxCategoryRevenue = Math.max(...categoryBreakdown.map((c) => c.revenue), 1);

  const top3Share = ranking.slice(0, 3).reduce((sum, r) => sum + r.sharePercent, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품 통계</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex shrink-0 flex-wrap rounded-md border border-zinc-300 text-sm">
          {(Object.keys(PRESET_LABELS) as Preset[])
            .filter((p) => p !== "custom")
            .map((p, i) => (
              <Link
                key={p}
                href={`/statistics/products?preset=${p}`}
                className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
                  p === preset ? "bg-[#C8075F] text-white" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {PRESET_LABELS[p]}
              </Link>
            ))}
        </div>
        <form className="flex items-end gap-2">
          <input type="hidden" name="preset" value="custom" />
          <div>
            <label className="mb-1 block text-xs text-zinc-500">시작일</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              max={kstTodayStr()}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">종료일</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              max={kstTodayStr()}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            조회
          </button>
        </form>
      </div>
      <p className="-mt-4 text-xs text-zinc-400">
        {from} ~ {to} 기준 (취소된 판매는 제외)
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">매출 합계</p>
          <p className="text-2xl font-semibold text-[#C8075F]">{totalRevenue.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">판매 건수</p>
          <p className="text-2xl font-semibold text-zinc-900">{saleCount.toLocaleString()}건</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">건당 평균</p>
          <p className="text-2xl font-semibold text-zinc-900">{avgPerSale.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">판매된 상품 종류</p>
          <p className="text-2xl font-semibold text-zinc-900">{ranking.length.toLocaleString()}개</p>
        </div>
      </div>

      {ranking.length > 0 && (
        <p className="rounded-lg border border-[#C8075F]/20 bg-[#C8075F]/5 px-4 py-3 text-sm text-zinc-700">
          상위 3개 상품이 이 기간 매출의 <span className="font-semibold text-[#C8075F]">{Math.round(top3Share)}%</span>를
          차지하고 있어요.
        </p>
      )}

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">시간대별 매출 분포</h2>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <div className="flex h-24 items-end gap-1">
            {hourlyDistribution.map((h) => (
              <div
                key={h.hour}
                title={`${h.hour}시: ${h.revenue.toLocaleString()}원`}
                className="flex-1 rounded-t bg-[#C8075F]/70 hover:bg-[#C8075F]"
                style={{ height: `${Math.max((h.revenue / maxHourlyRevenue) * 100, h.revenue > 0 ? 4 : 0)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-400">
            <span>0시</span>
            <span>6시</span>
            <span>12시</span>
            <span>18시</span>
            <span>23시</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">일별 매출 추이</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <div className="flex h-32 items-end gap-1" style={{ minWidth: dailyTrend.length * 20 }}>
            {dailyTrend.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.revenue.toLocaleString()}원`}
                className="w-4 shrink-0 rounded-t bg-[#C8075F]/70 hover:bg-[#C8075F]"
                style={{ height: `${Math.max((d.revenue / maxDailyRevenue) * 100, d.revenue > 0 ? 3 : 0)}%` }}
              />
            ))}
          </div>
          {dailyTrend.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-zinc-400">
              <span>{dailyTrend[0].date}</span>
              <span>{dailyTrend[dailyTrend.length - 1].date}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">카테고리별 매출 비중</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-zinc-400">해당 기간 판매 내역이 없습니다.</p>
          ) : (
            categoryBreakdown.map((c) => (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{c.category}</span>
                  <span className="text-zinc-500">
                    {c.revenue.toLocaleString()}원 ({Math.round(c.percent)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-[#C8075F]"
                    style={{ width: `${(c.revenue / maxCategoryRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">상품별 매출 기여</h2>
          <StatsExcelButton rows={ranking} fileLabel={`상품통계_${from}_${to}`} />
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">순위</th>
                <th className="px-4 py-3">등급</th>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">판매수량</th>
                <th className="px-4 py-3">매출액</th>
                <th className="px-4 py-3">매출비중</th>
                <th className="px-4 py-3">누적비중</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.product_id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${GRADE_STYLE[r.grade]}`}>
                      {r.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.category}</td>
                  <td className="px-4 py-3">{r.quantity.toLocaleString()}개</td>
                  <td className="px-4 py-3">{r.revenue.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-zinc-500">{r.sharePercent.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-zinc-500">{r.cumulativePercent.toFixed(1)}%</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                    해당 기간 판매 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-base font-medium text-zinc-700">
          판매 없는 상품 ({deadStock.length}개) — 재고는 있는데 이 기간 매출에 기여하지 못했어요
        </summary>
        <div className="overflow-x-auto border-t border-zinc-100">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">재고수량</th>
              </tr>
            </thead>
            <tbody>
              {deadStock.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.category}</td>
                  <td className="px-4 py-3">{p.stock_qty.toLocaleString()}개</td>
                </tr>
              ))}
              {deadStock.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                    재고가 있는 상품은 모두 이 기간에 팔렸어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
