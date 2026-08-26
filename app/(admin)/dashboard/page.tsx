import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/types";
import type { Product } from "@/lib/types";

function dayRangeIso(offsetDays: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const today = dayRangeIso(0);
  const yesterday = dayRangeIso(-1);
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadStr = weekAhead.toISOString().slice(0, 10);

  const [
    { data: productsData },
    { data: todayData },
    { data: yesterdayData },
    { data: expiryData },
    { data: cashSalesData },
    { data: cashTxData },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .order("stock_qty", { ascending: true }),
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
  ]);

  const products = (productsData ?? []) as Product[];
  const lowStock = products.filter((p) => p.stock_qty <= p.low_stock_threshold);

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
            매출조회
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
          <Link href="/products" className="text-[#C8075F] underline">
            상품관리
          </Link>
          에서 상품별로 조정할 수 있습니다.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">
          소비기한 임박 상품 ({expiringSoon.length}개)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-base">
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
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-12 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-zinc-300"
          >
            <path d="M15 10l4.55-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.45.894L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
          </svg>
          <p className="text-sm text-zinc-500">아직 연결된 카메라가 없습니다.</p>
          <p className="text-xs text-zinc-400">
            매장에서 쓰시는 CCTV/카메라 시스템 정보를 알려주시면 실시간 화면을
            연동해드릴게요.
          </p>
        </div>
      </div>
    </div>
  );
}
