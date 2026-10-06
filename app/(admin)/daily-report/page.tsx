import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";

// 어제 00:00~오늘 00:00(로컬 기준) 범위 — 대시보드의 dayRangeIso와 같은 방식.
function yesterdayRangeIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    dateLabel: start.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }),
  };
}

type ProductRow = { id: string; name: string; barcode: string; stock_qty: number; low_stock_threshold: number };
type ExpiryRow = {
  id: string;
  expiry_date: string;
  quantity: number;
  products: { name: string; barcode: string } | null;
};

export default async function DailyReportPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { fromIso, toIso, dateLabel } = yesterdayRangeIso();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAheadStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: ySalesData },
    { data: yCancelledData },
    productRows,
    { data: expiryData },
    { data: reviewOrders },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .eq("status", "completed")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    supabase
      .from("sales")
      .select("id")
      .eq("store_id", store.id)
      .eq("status", "cancelled")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    fetchAllPages<ProductRow>((from, to) =>
      supabase
        .from("products")
        .select("id, name, barcode, stock_qty, low_stock_threshold")
        .eq("store_id", store.id)
        .range(from, to)
        .then((res) => ({ data: res.data as unknown as ProductRow[] | null, error: res.error }))
    ),
    supabase
      .from("product_expiries")
      .select("id, expiry_date, quantity, products(name, barcode)")
      .eq("store_id", store.id)
      .lte("expiry_date", weekAheadStr)
      .order("expiry_date", { ascending: true }),
    supabase.from("purchase_orders").select("id").eq("store_id", store.id).eq("status", "requested"),
  ]);

  const yesterdayRevenue = (ySalesData ?? []).reduce((sum, s) => sum + s.total_amount, 0);
  const yesterdayCount = (ySalesData ?? []).length;
  const yesterdayAvg = yesterdayCount > 0 ? Math.round(yesterdayRevenue / yesterdayCount) : 0;
  const yesterdayCancelCount = (yCancelledData ?? []).length;

  const lowStock = productRows
    .filter((p) => p.stock_qty <= p.low_stock_threshold)
    .sort((a, b) => a.stock_qty - b.stock_qty);

  const expiringSoon = (expiryData ?? []) as unknown as ExpiryRow[];
  const reviewCount = (reviewOrders ?? []).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">일일 요약</h1>
        <p className="text-sm text-zinc-500">{store.name} · 긴급하지 않은 사항을 하루 단위로 모아보는 화면입니다.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        도난·보안 이슈나 냉장고 전원 차단처럼 즉시 대응이 필요한 사항은 센서·보안 연동이 추가되면
        별도 실시간 알림으로 안내할 예정입니다(현재 미구현). 지금은 그 외 일상적인 운영 사항을
        하루 한 번 이 화면에서 모아볼 수 있습니다.
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">어제({dateLabel}) 영업 요약</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">매출</p>
            <p className="text-3xl font-semibold text-[#C8075F]">{yesterdayRevenue.toLocaleString()}원</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">판매 건수</p>
            <p className="text-3xl font-semibold text-zinc-900">{yesterdayCount.toLocaleString()}건</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">건당 평균</p>
            <p className="text-3xl font-semibold text-zinc-900">{yesterdayAvg.toLocaleString()}원</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">취소 건수</p>
            <p className="text-3xl font-semibold text-zinc-900">{yesterdayCancelCount.toLocaleString()}건</p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">재고소진임박 상품 ({lowStock.length}개)</h2>
          <Link href="/products?view=low-stock" className="text-sm text-[#C8075F] underline">
            자세히 보기
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">현재 재고</th>
                <th className="px-4 py-3">기준</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 5).map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 font-medium text-red-600">{p.stock_qty}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.low_stock_threshold}</td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                    재고 부족 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {lowStock.length > 5 && (
          <p className="mt-2 text-sm text-zinc-400">
            이 외 {lowStock.length - 5}개 더 — 재고소진상품 화면에서 전체 확인 및 발주할 수 있습니다.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">소비기한 임박 상품 ({expiringSoon.length}개)</h2>
          <Link href="/expiry" className="text-sm text-[#C8075F] underline">
            소비기한 등록으로 이동
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">소비기한</th>
                <th className="px-4 py-3">상품명</th>
                <th className="px-4 py-3">수량</th>
              </tr>
            </thead>
            <tbody>
              {expiringSoon.slice(0, 5).map((e) => {
                const overdue = e.expiry_date <= todayStr;
                return (
                  <tr key={e.id} className="border-t border-zinc-100">
                    <td className={`px-4 py-3 font-medium ${overdue ? "text-red-600" : "text-amber-600"}`}>
                      {e.expiry_date}
                      {overdue ? " (경과)" : ""}
                    </td>
                    <td className="px-4 py-3">{e.products?.name ?? "-"}</td>
                    <td className="px-4 py-3">{e.quantity}</td>
                  </tr>
                );
              })}
              {expiringSoon.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                    일주일 내 소비기한 임박 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-zinc-700">발주 검토대기 ({reviewCount}건)</h2>
          <Link href="/purchase-orders" className="text-sm text-[#C8075F] underline">
            발주관리로 이동
          </Link>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-700">
          {reviewCount > 0
            ? `승인 또는 반려가 필요한 발주가 ${reviewCount}건 있습니다.`
            : "검토 대기 중인 발주가 없습니다."}
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        현금 잔액 알림, 배송주문 처리 대기 등 좀 더 급한 사항은 홈 화면에서 실시간으로 안내됩니다.
      </p>
    </div>
  );
}
