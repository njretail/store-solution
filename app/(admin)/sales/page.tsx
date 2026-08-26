import Link from "next/link";
import { requireAdmin, getCurrentStore, getAccessibleStores } from "@/lib/session";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function FilterBar({
  from,
  to,
  scope,
}: {
  from: string;
  to: string;
  scope: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form className="flex items-end gap-3">
        <input type="hidden" name="scope" value={scope} />
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

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; scope?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const today = toDateInputValue(new Date());
  const from = params.from || today;
  const to = params.to || today;
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
          <h1 className="text-2xl font-semibold text-zinc-900">매출조회</h1>
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
          <table className="w-full text-base">
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

  const { data } = await supabase
    .from("sales")
    .select("id, total_amount, discount_amount, payment_method, created_at")
    .eq("store_id", store.id)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  const sales = data ?? [];
  const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">매출조회</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <FilterBar from={from} to={to} scope={scope} />

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

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">일시</th>
              <th className="px-3 py-2">결제수단</th>
              <th className="px-3 py-2">할인</th>
              <th className="px-3 py-2">금액</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-zinc-500">
                  {new Date(s.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2">
                  {s.payment_method === "card" ? "카드" : "현금"}
                </td>
                <td className="px-3 py-2 text-zinc-500">
                  {s.discount_amount > 0
                    ? `-${s.discount_amount.toLocaleString()}원`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {s.total_amount.toLocaleString()}원
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
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
