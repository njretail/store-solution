import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/types";

function dayRangeIso(offsetDays: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

// monthOffset=0이면 이번달 1일부터 오늘까지, -1이면 지난달 1일부터 "이번달과 같은 날짜"까지
// (월 길이가 다르면 그 달의 마지막 날로 맞춤) — 두 달을 같은 진행 기간끼리 공정하게 비교하기 위함.
function monthToDateRangeIso(monthOffset: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + monthOffset;
  const start = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dayCutoff = Math.min(now.getDate(), daysInMonth);
  const end = new Date(y, m, dayCutoff + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function CompareBar({
  title,
  labelA,
  valueA,
  labelB,
  valueB,
}: {
  title: string;
  labelA: string;
  valueA: number;
  labelB: string;
  valueB: number;
}) {
  const max = Math.max(valueA, valueB, 1);
  const diff = valueA > 0 ? Math.round(((valueB - valueA) / valueA) * 100) : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">{labelA}</span>
          <span className="text-zinc-600">{valueA.toLocaleString()}원</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-300"
            style={{ width: `${(valueA / max) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700">{labelB}</span>
          <span className="font-semibold text-zinc-900">{valueB.toLocaleString()}원</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-[#C8075F]"
            style={{ width: `${(valueB / max) * 100}%` }}
          />
        </div>
      </div>
      {diff !== null ? (
        <p
          className={`text-xs font-medium ${diff >= 0 ? "text-green-600" : "text-red-500"}`}
        >
          {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}% {diff >= 0 ? "증가" : "감소"}
        </p>
      ) : (
        <p className="text-xs text-zinc-400">비교할 이전 매출이 없습니다.</p>
      )}
    </div>
  );
}

function dateRangeIsoForDate(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

type ComparePeriod = "yesterday" | "week" | "month" | "custom";

const COMPARE_LABELS: Record<ComparePeriod, string> = {
  yesterday: "어제 대비",
  week: "일주일전 대비",
  month: "전월 대비",
  custom: "직접 설정",
};

type RankPeriod = "day" | "month" | "year";

const RANK_PERIOD_LABELS: Record<RankPeriod, string> = {
  day: "일별",
  month: "월별",
  year: "연별",
};

function rankPeriodDefault(period: RankPeriod): string {
  const now = new Date();
  if (period === "day") return now.toISOString().slice(0, 10);
  if (period === "month") return now.toISOString().slice(0, 7);
  return String(now.getFullYear());
}

function rankPeriodRange(period: RankPeriod, value: string) {
  if (period === "month") {
    const [y, m] = value.split("-").map(Number);
    const start = new Date(y, (m || 1) - 1, 1);
    const end = new Date(y, m || 1, 1);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }
  if (period === "year") {
    const y = Number(value) || new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }
  const start = new Date(`${value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    rank_period?: string;
    rank_value?: string;
    compare?: string;
    compare_date?: string;
  }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const rankPeriod: RankPeriod =
    params.rank_period === "month" || params.rank_period === "year"
      ? params.rank_period
      : "day";
  const rankValue = params.rank_value || rankPeriodDefault(rankPeriod);
  const rankRange = rankPeriodRange(rankPeriod, rankValue);

  const comparePeriod: ComparePeriod =
    params.compare === "week" || params.compare === "month" || params.compare === "custom"
      ? params.compare
      : "yesterday";
  const compareDateDefault = dayRangeIso(-7).fromIso.slice(0, 10);
  const compareDate = params.compare_date || compareDateDefault;

  const today = dayRangeIso(0);
  const yesterday = dayRangeIso(-1);
  const weekAgo = dayRangeIso(-7);
  const thisMonth = monthToDateRangeIso(0);
  const lastMonth = monthToDateRangeIso(-1);
  const customRange = dateRangeIsoForDate(compareDate);
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadStr = weekAhead.toISOString().slice(0, 10);

  const [
    { data: todayData },
    { data: yesterdayData },
    { data: weekAgoData },
    { data: thisMonthData },
    { data: lastMonthData },
    { data: customData },
    { data: expiryData },
    { data: cashSalesData },
    { data: cashTxData },
    { data: rankData },
    { data: cameraData },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total_amount, payment_method")
      .eq("store_id", store.id)
      .gte("created_at", today.fromIso)
      .lt("created_at", today.toIso),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", yesterday.fromIso)
      .lt("created_at", yesterday.toIso),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", weekAgo.fromIso)
      .lt("created_at", weekAgo.toIso),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", thisMonth.fromIso)
      .lt("created_at", thisMonth.toIso),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", lastMonth.fromIso)
      .lt("created_at", lastMonth.toIso),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .gte("created_at", customRange.fromIso)
      .lt("created_at", customRange.toIso),
    supabase
      .from("product_expiries")
      .select("id, expiry_date, quantity, products(name, barcode)")
      .eq("store_id", store.id)
      .lte("expiry_date", weekAheadStr)
      .order("expiry_date", { ascending: true }),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .eq("payment_method", "cash"),
    supabase
      .from("cash_transactions")
      .select("type, amount")
      .eq("store_id", store.id),
    supabase.rpc("top_products", {
      p_store_id: store.id,
      p_from: rankRange.fromIso,
      p_to: rankRange.toIso,
      p_limit: 10,
    }),
    supabase.from("cameras").select("id").eq("store_id", store.id),
  ]);

  const cameraCount = (cameraData ?? []).length;

  const weekAgoRevenue = (weekAgoData ?? []).reduce((sum, s) => sum + s.total_amount, 0);
  const thisMonthRevenue = (thisMonthData ?? []).reduce((sum, s) => sum + s.total_amount, 0);
  const lastMonthRevenue = (lastMonthData ?? []).reduce((sum, s) => sum + s.total_amount, 0);
  const customRevenue = (customData ?? []).reduce((sum, s) => sum + s.total_amount, 0);

  const topProducts = (rankData ?? []) as Array<{
    product_id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;

  const expiringSoon = (expiryData ?? []) as unknown as Array<{
    id: string;
    expiry_date: string;
    quantity: number;
    products: { name: string; barcode: string } | null;
  }>;

  const cashSalesTotal = (cashSalesData ?? []).reduce(
    (sum, s) => sum + s.total_amount,
    0
  );
  const cashDeposits = (cashTxData ?? [])
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashWithdrawals = (cashTxData ?? [])
    .filter((t) => t.type === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashBalance = cashSalesTotal + cashDeposits - cashWithdrawals;
  const cashLow =
    store.cash_alert_threshold != null && cashBalance < store.cash_alert_threshold;

  const todaySales = todayData ?? [];
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total_amount, 0);
  const todayCount = todaySales.length;
  const todayAvg = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0;

  const yesterdayRevenue = (yesterdayData ?? []).reduce(
    (sum, s) => sum + s.total_amount,
    0
  );
  const changePercent =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : null;

  const compareCard: { title: string; labelA: string; valueA: number; labelB: string; valueB: number } =
    comparePeriod === "week"
      ? { title: "일주일 전 대비 오늘", labelA: "일주일 전", valueA: weekAgoRevenue, labelB: "오늘", valueB: todayRevenue }
      : comparePeriod === "month"
        ? { title: "전월 대비 이달(같은 기간까지)", labelA: "전월", valueA: lastMonthRevenue, labelB: "이달", valueB: thisMonthRevenue }
        : comparePeriod === "custom"
          ? { title: `${compareDate} 대비 오늘`, labelA: compareDate, valueA: customRevenue, labelB: "오늘", valueB: todayRevenue }
          : { title: "어제 대비 오늘", labelA: "어제", valueA: yesterdayRevenue, labelB: "오늘", valueB: todayRevenue };

  const byMethod = new Map<string, number>();
  for (const s of todaySales) {
    byMethod.set(s.payment_method, (byMethod.get(s.payment_method) ?? 0) + s.total_amount);
  }
  const methodBreakdown: { label: string; amount: number }[] = PAYMENT_METHODS.map(
    (m) => ({
      label: m.label as string,
      amount: byMethod.get(m.value) ?? 0,
    })
  )
    // 정의되지 않은(과거 데이터 등) 결제수단 값도 놓치지 않도록 포함
    .concat(
      Array.from(byMethod.keys())
        .filter((k) => !PAYMENT_METHODS.some((m) => m.value === k))
        .map((k) => ({ label: paymentMethodLabel(k), amount: byMethod.get(k)! }))
    )
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex flex-col gap-8">
      {cashLow && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>
            ⚠️ 현금 잔액이 알림 기준({store.cash_alert_threshold!.toLocaleString()}
            원) 아래로 떨어졌습니다. (현재 {cashBalance.toLocaleString()}원)
          </span>
          <Link href="/cash" className="shrink-0 font-medium underline">
            현금관리로 이동
          </Link>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">오늘 매출</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">오늘 매출</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold text-[#C8075F]">
                {todayRevenue.toLocaleString()}원
              </p>
              {changePercent !== null && (
                <span
                  className={`text-sm font-medium ${
                    changePercent >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {changePercent >= 0 ? "▲" : "▼"} {Math.abs(changePercent)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {changePercent === null
                ? "전일 매출 없음"
                : "전일 대비"}
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
          <Link href="/sales" className="text-[#C8075F] underline">
            판매내역
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          결제수단별 오늘 매출
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
          {todayRevenue === 0 ? (
            <p className="text-sm text-zinc-400">오늘 판매 내역이 없습니다.</p>
          ) : (
            methodBreakdown
              .filter((m) => m.amount > 0)
              .map((m) => {
                const pct = Math.round((m.amount / todayRevenue) * 100);
                return (
                  <div key={m.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">{m.label}</span>
                      <span className="text-zinc-500">
                        {m.amount.toLocaleString()}원 ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-[#C8075F]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">매출 비교</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 rounded-md border border-zinc-300 text-sm">
              {(Object.keys(COMPARE_LABELS) as ComparePeriod[]).map((p, i) => (
                <Link
                  key={p}
                  href={
                    p === "custom"
                      ? `/dashboard?compare=custom&compare_date=${compareDateDefault}`
                      : `/dashboard?compare=${p}`
                  }
                  className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
                    p === comparePeriod
                      ? "bg-[#C8075F] text-white"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {COMPARE_LABELS[p]}
                </Link>
              ))}
            </div>
            {comparePeriod === "custom" && (
              <form className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="compare" value="custom" />
                <input
                  type="date"
                  name="compare_date"
                  defaultValue={compareDate}
                  max={todayStr}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="shrink-0 whitespace-nowrap rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                >
                  조회
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="max-w-sm">
          <CompareBar {...compareCard} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">잘나가는 상품</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 rounded-md border border-zinc-300 text-sm">
              {(Object.keys(RANK_PERIOD_LABELS) as RankPeriod[]).map((p, i) => (
                <Link
                  key={p}
                  href={`/dashboard?rank_period=${p}&rank_value=${rankPeriodDefault(p)}`}
                  className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
                    p === rankPeriod
                      ? "bg-[#C8075F] text-white"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {RANK_PERIOD_LABELS[p]}
                </Link>
              ))}
            </div>
            <form className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="rank_period" value={rankPeriod} />
              {rankPeriod === "day" && (
                <input
                  type="date"
                  name="rank_value"
                  defaultValue={rankValue}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              )}
              {rankPeriod === "month" && (
                <input
                  type="month"
                  name="rank_value"
                  defaultValue={rankValue}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              )}
              {rankPeriod === "year" && (
                <input
                  type="number"
                  name="rank_value"
                  defaultValue={rankValue}
                  className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              )}
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                조회
              </button>
            </form>
          </div>
        </div>
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
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          소비기한 임박 상품 ({expiringSoon.length}개)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">소비기한</th>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">바코드</th>
                <th className="px-4 py-3">수량</th>
              </tr>
            </thead>
            <tbody>
              {expiringSoon.map((e) => {
                const overdue = e.expiry_date <= todayStr;
                return (
                  <tr key={e.id} className="border-t border-zinc-100">
                    <td
                      className={`px-4 py-3 font-medium ${overdue ? "text-red-600" : "text-amber-600"}`}
                    >
                      {e.expiry_date}
                      {overdue ? " (경과)" : ""}
                    </td>
                    <td className="px-4 py-3">{e.products?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {e.products?.barcode ?? "-"}
                    </td>
                    <td className="px-4 py-3">{e.quantity}</td>
                  </tr>
                );
              })}
              {expiringSoon.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    일주일 내 소비기한 임박 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          소비기한은{" "}
          <Link href="/expiry" className="text-[#C8075F] underline">
            소비기한 등록
          </Link>
          에서 상품을 스캔하거나 바코드로 조회해 등록할 수 있습니다.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">매장 카메라</h2>
        <Link
          href="/cameras"
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 hover:bg-zinc-50"
        >
          <div className="flex items-center gap-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 text-zinc-400"
            >
              <path d="M15 10l4.55-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.45.894L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
            </svg>
            <p className="text-sm text-zinc-700">
              {cameraCount > 0
                ? `등록된 카메라 ${cameraCount}대`
                : "아직 등록된 카메라가 없습니다."}
            </p>
          </div>
          <span className="shrink-0 text-sm text-[#C8075F] underline">
            카메라보기로 이동
          </span>
        </Link>
      </div>
    </div>
  );
}
