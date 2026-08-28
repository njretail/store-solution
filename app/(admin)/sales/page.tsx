import Link from "next/link";
import { requireAdmin, getCurrentStore, getAccessibleStores } from "@/lib/session";
import { paymentMethodLabel, SALE_STATUS_LABELS, type SaleStatus } from "@/lib/types";
import SalesExcelButton from "@/app/components/SalesExcelButton";

const STATUS_TABS: Array<{ value: "all" | SaleStatus; label: string }> = [
  { value: "all", label: "전체" },
  { value: "completed", label: "정상" },
  { value: "cancelled", label: "취소" },
];

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function FilterBar({
  from,
  to,
  scope,
  status,
}: {
  from: string;
  to: string;
  scope: string;
  status?: "all" | SaleStatus;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form className="flex items-end gap-3">
        <input type="hidden" name="scope" value={scope} />
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">종료일</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          조회
        </button>
      </form>

      <Link
        href={`/sales?from=${from}&to=${to}&scope=${scope === "all" ? "store" : "all"}`}
        className="text-sm text-[#C8075F] underline"
      >
        {scope === "all" ? "매장별로 보기" : "전체 매장 합산 보기"}
      </Link>
    </div>
  );
}

function StatusTabs({
  from,
  to,
  status,
}: {
  from: string;
  to: string;
  status: "all" | SaleStatus;
}) {
  return (
    <div className="flex shrink-0 rounded-md border border-zinc-300 text-sm">
      {STATUS_TABS.map((t, i) => (
        <Link
          key={t.value}
          href={`/sales?from=${from}&to=${to}&scope=store&status=${t.value}`}
          className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
            t.value === status ? "bg-[#C8075F] text-white" : "text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; scope?: string; status?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const today = toDateInputValue(new Date());
  const from = params.from || today;
  const to = params.to || today;
  const statusFilter: "all" | SaleStatus =
    params.status === "completed" || params.status === "cancelled" ? params.status : "all";
  const scope = params.scope === "all" ? "all" : "store";

  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  if (scope === "all") {
    const [{ data }, stores] = await Promise.all([
      supabase
        .from("sales")
        .select("id, store_id, total_amount, discount_amount")
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      getAccessibleStores(supabase),
    ]);

    const sales = data ?? [];
    const byStore = new Map<string, { total: number; count: number }>();
    for (const s of sales) {
      const cur = byStore.get(s.store_id) ?? { total: 0, count: 0 };
      cur.total += s.total_amount;
      cur.count += 1;
      byStore.set(s.store_id, cur);
    }
    const grandTotal = sales.reduce((sum, s) => sum + s.total_amount, 0);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">판매내역</h1>
          <p className="text-sm text-zinc-500">전체 매장 합산</p>
        </div>

        <FilterBar from={from} to={to} scope={scope} />

        <div className="flex gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-500">전체 매출 합계</p>
            <p className="text-2xl font-semibold text-zinc-900">
              {grandTotal.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-500">전체 거래 건수</p>
            <p className="text-2xl font-semibold text-zinc-900">
              {sales.length}건
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">매장</th>
                <th className="px-3 py-2">거래 건수</th>
                <th className="px-3 py-2">매출 합계</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const row = byStore.get(s.id);
                return (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{row?.count ?? 0}건</td>
                    <td className="px-3 py-2">
                      {(row?.total ?? 0).toLocaleString()}원
                    </td>
                  </tr>
                );
              })}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
                    등록된 매장이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  let query = supabase
    .from("sales")
    .select("id, total_amount, discount_amount, payment_method, status, created_at")
    .eq("store_id", store.id)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  const { data } = await query.order("created_at", { ascending: false });

  const sales = (data ?? []) as Array<{
    id: string;
    total_amount: number;
    discount_amount: number;
    payment_method: string;
    status: SaleStatus;
    created_at: string;
  }>;

  const saleIds = sales.map((s) => s.id);
  const { data: itemsData } =
    saleIds.length > 0
      ? await supabase
          .from("sale_items")
          .select("sale_id, quantity, products(name)")
          .in("sale_id", saleIds)
      : { data: [] };

  const itemsBySale = new Map<string, Array<{ name: string; quantity: number }>>();
  for (const it of (itemsData ?? []) as unknown as Array<{
    sale_id: string;
    quantity: number;
    products: { name: string } | null;
  }>) {
    const list = itemsBySale.get(it.sale_id) ?? [];
    list.push({ name: it.products?.name ?? "상품", quantity: it.quantity });
    itemsBySale.set(it.sale_id, list);
  }

  function productSummary(saleId: string) {
    const items = itemsBySale.get(saleId) ?? [];
    if (items.length === 0) return "-";
    const first = items[0].name;
    return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
  }

  const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);

  const excelRows = sales.map((s) => ({
    일시: new Date(s.created_at).toLocaleString("ko-KR"),
    상품: productSummary(s.id),
    결제수단: paymentMethodLabel(s.payment_method),
    할인: s.discount_amount,
    결제금액: s.total_amount,
    판매상태: SALE_STATUS_LABELS[s.status ?? "completed"],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">판매내역</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <FilterBar from={from} to={to} scope={scope} status={statusFilter} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-500">매출 합계</p>
            <p className="text-2xl font-semibold text-zinc-900">
              {totalAmount.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-500">거래 건수</p>
            <p className="text-2xl font-semibold text-zinc-900">{sales.length}건</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusTabs from={from} to={to} status={statusFilter} />
          <SalesExcelButton rows={excelRows} fileLabel={`판매내역_${from}_${to}`} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">상품</th>
              <th className="px-3 py-2">일시</th>
              <th className="px-3 py-2">결제수단</th>
              <th className="px-3 py-2">할인</th>
              <th className="px-3 py-2">금액</th>
              <th className="px-3 py-2">판매상태</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => {
              const status = s.status ?? "completed";
              return (
                <tr key={s.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <Link href={`/sales/${s.id}`} className="block text-[#C8075F]">
                      {productSummary(s.id)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {new Date(s.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">
                    {paymentMethodLabel(s.payment_method)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {s.discount_amount > 0
                      ? `-${s.discount_amount.toLocaleString()}원`
                      : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {s.total_amount.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        status === "cancelled"
                          ? "text-red-600"
                          : "text-zinc-700"
                      }
                    >
                      {SALE_STATUS_LABELS[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                  해당 기간 매출이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
