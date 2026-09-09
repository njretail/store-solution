import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/types";

type RangeKey = "7" | "30" | "90";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7": "최근 7일",
  "30": "최근 30일",
  "90": "최근 90일",
};

function isRangeKey(v: string | undefined): v is RangeKey {
  return v === "7" || v === "30" || v === "90";
}

// end는 "내일 0시"(배타적 상한), start는 거기서 days일을 뺀 자정 — 오늘까지 포함해서 days일치.
function periodRangeIso(days: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end, fromIso: start.toISOString(), toIso: end.toISOString() };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${m}/${d}`;
}

// 일별 매출 막대그래프 — 데이터가 하는 일이 "크기 비교"뿐인 단일 시리즈라 색은
// 브랜드 컬러 하나만 쓴다(막대마다 다른 색을 쓰지 않음).
function TrendChart({ days }: { days: { key: string; revenue: number }[] }) {
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  // 눈금은 딱 떨어지는 수로 반올림한다(0 / 1,000 / 2,000 같은 값).
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxRevenue)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) {
      if (maxRevenue <= s * magnitude) return s * magnitude;
    }
    return 10 * magnitude;
  })();
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((niceMax * f) / 100) * 100);

  const slot = 22;
  const barW = 14;
  const plotH = 180;
  const leftPad = 64;
  const bottomPad = 24;
  const width = leftPad + days.length * slot + 8;
  const height = plotH + bottomPad + 8;

  const yFor = (v: number) => 8 + plotH - (v / niceMax) * plotH;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4">
      <svg width={width} height={height} role="img" aria-label="일별 매출 추이 막대그래프">
        {/* 격자선 + y축 눈금 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={leftPad}
              x2={width - 4}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text x={leftPad - 8} y={yFor(t) + 4} textAnchor="end" fontSize={11} fill="#898781">
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {/* 막대: 위쪽만 둥글게(4px), 바닥은 각지게 — 둥근 rect 위에 각진 조각을 덧대는 방식 */}
        {days.map((d, i) => {
          const x = leftPad + i * slot + (slot - barW) / 2;
          const barH = Math.max((d.revenue / niceMax) * plotH, d.revenue > 0 ? 2 : 0);
          const y = yFor(d.revenue);
          const baseline = yFor(0);
          return (
            <g key={d.key}>
              <title>{`${d.key}: ${d.revenue.toLocaleString()}원`}</title>
              {barH > 0 && (
                <>
                  <rect x={x} y={y} width={barW} height={barH} rx={4} ry={4} fill="#C8075F" />
                  <rect
                    x={x}
                    y={Math.max(y, baseline - 4)}
                    width={barW}
                    height={4}
                    fill="#C8075F"
                  />
                </>
              )}
            </g>
          );
        })}

        <line
          x1={leftPad}
          x2={width - 4}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke="#c3c2b7"
          strokeWidth={1}
        />

        {/* x축: 맨 앞/맨 뒤 날짜만 직접 라벨링(중간은 빽빽해서 표로 대체) */}
        {days.length > 0 && (
          <text
            x={leftPad + (slot - barW) / 2 + barW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={11}
            fill="#898781"
          >
            {shortLabel(days[0].key)}
          </text>
        )}
        {days.length > 1 && (
          <text
            x={leftPad + (days.length - 1) * slot + (slot - barW) / 2 + barW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={11}
            fill="#898781"
          >
            {shortLabel(days[days.length - 1].key)}
          </text>
        )}
      </svg>
    </div>
  );
}

function BarRow({ label, amount, pct }: { label: string; amount: number; pct: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-700">{label}</span>
        <span className="text-zinc-500">
          {amount.toLocaleString()}원 ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-[#C8075F]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const range: RangeKey = isRangeKey(params.range) ? params.range : "30";
  const { start, end, fromIso, toIso } = periodRangeIso(Number(range));

  type SaleRow = { total_amount: number; payment_method: string; created_at: string };
  type SaleItemRow = {
    quantity: number;
    subtotal: number;
    sales: { created_at: string } | null;
    products: { categories: { name: string } | null } | null;
  };

  const [salesData, itemsData, { data: rankData }] = await Promise.all([
    fetchAllPages<SaleRow>((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, payment_method, created_at")
        .eq("store_id", store.id)
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .range(from, to)
        .then((res) => ({ data: res.data as unknown as SaleRow[] | null, error: res.error }))
    ),
    fetchAllPages<SaleItemRow>((from, to) =>
      supabase
        .from("sale_items")
        .select("quantity, subtotal, sales!inner(created_at), products(categories(name))")
        .eq("store_id", store.id)
        .gte("sales.created_at", fromIso)
        .lt("sales.created_at", toIso)
        .range(from, to)
        .then((res) => ({ data: res.data as unknown as SaleItemRow[] | null, error: res.error }))
    ),
    supabase.rpc("top_products", {
      p_store_id: store.id,
      p_from: fromIso,
      p_to: toIso,
      p_limit: 10,
    }),
  ]);

  // 일별 매출 — 판매가 없는 날도 0으로 채워서 막대그래프에 빈 날짜가 비지 않게 한다.
  const dailyMap = new Map<string, number>();
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dailyMap.set(dateKey(d), 0);
  }
  for (const s of salesData) {
    const k = dateKey(new Date(s.created_at));
    dailyMap.set(k, (dailyMap.get(k) ?? 0) + s.total_amount);
  }
  const dailyRows = [...dailyMap.entries()].map(([key, revenue]) => ({ key, revenue }));

  const totalRevenue = salesData.reduce((sum, s) => sum + s.total_amount, 0);
  const totalCount = salesData.length;
  const avgOrderValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

  const byMethod = new Map<string, number>();
  for (const s of salesData) {
    byMethod.set(s.payment_method, (byMethod.get(s.payment_method) ?? 0) + s.total_amount);
  }
  const methodBreakdown = PAYMENT_METHODS.map((m) => ({
    label: m.label as string,
    amount: byMethod.get(m.value) ?? 0,
  }))
    .concat(
      Array.from(byMethod.keys())
        .filter((k) => !PAYMENT_METHODS.some((m) => m.value === k))
        .map((k) => ({ label: paymentMethodLabel(k), amount: byMethod.get(k)! }))
    )
    .filter((m) => m.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const byCategory = new Map<string, number>();
  for (const it of itemsData) {
    const cat = it.products?.categories?.name ?? "미분류";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + it.subtotal);
  }
  const categoryBreakdown = [...byCategory.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topProducts = (rankData ?? []) as Array<{
    product_id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">통계</h1>
          <p className="text-sm text-zinc-500">{store.name}</p>
        </div>
        <div className="flex shrink-0 rounded-md border border-zinc-300 text-sm">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r, i) => (
            <Link
              key={r}
              href={`/stats?range=${r}`}
              className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
                r === range ? "bg-[#C8075F] text-white" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">{RANGE_LABELS[range]} 매출</p>
          <p className="text-3xl font-semibold text-[#C8075F]">{totalRevenue.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">판매 건수</p>
          <p className="text-3xl font-semibold text-zinc-900">{totalCount.toLocaleString()}건</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">건당 평균(객단가)</p>
          <p className="text-3xl font-semibold text-zinc-900">{avgOrderValue.toLocaleString()}원</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">매출 추이</h2>
        <TrendChart days={dailyRows} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-medium text-zinc-700">분류별 매출</h2>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-400">해당 기간 판매 내역이 없습니다.</p>
            ) : (
              categoryBreakdown.map((c) => (
                <BarRow
                  key={c.label}
                  label={c.label}
                  amount={c.amount}
                  pct={totalRevenue > 0 ? Math.round((c.amount / totalRevenue) * 100) : 0}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-medium text-zinc-700">결제수단별 비중</h2>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
            {methodBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-400">해당 기간 판매 내역이 없습니다.</p>
            ) : (
              methodBreakdown.map((m) => (
                <BarRow
                  key={m.label}
                  label={m.label}
                  amount={m.amount}
                  pct={totalRevenue > 0 ? Math.round((m.amount / totalRevenue) * 100) : 0}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          상품 판매 순위 ({RANGE_LABELS[range]})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">순위</th>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">판매수량</th>
                <th className="px-4 py-3">매출액</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.product_id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">{i + 1}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.quantity.toLocaleString()}개</td>
                  <td className="px-4 py-3">{p.revenue.toLocaleString()}원</td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    해당 기간 판매 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">일별 매출 (표로 보기)</h2>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-sm [font-variant-numeric:tabular-nums]">
            <thead className="sticky top-0 bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-2">날짜</th>
                <th className="px-4 py-2">매출</th>
              </tr>
            </thead>
            <tbody>
              {[...dailyRows].reverse().map((d) => (
                <tr key={d.key} className="border-t border-zinc-100">
                  <td className="px-4 py-2 text-zinc-600">{d.key}</td>
                  <td className="px-4 py-2">{d.revenue.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
