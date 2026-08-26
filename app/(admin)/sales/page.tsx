import { requireAdmin, getCurrentStore } from "@/lib/session";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const today = toDateInputValue(new Date());
  const from = params.from || today;
  const to = params.to || today;

  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  const { data } = await supabase
    .from("sales")
    .select("id, total_amount, payment_method, created_at")
    .eq("store_id", store.id)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  const sales = data ?? [];
  const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">매출조회</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <form className="flex items-end gap-3">
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

      <div className="flex gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-500">매출 합계</p>
          <p className="text-lg font-semibold text-zinc-900">
            {totalAmount.toLocaleString()}원
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-500">거래 건수</p>
          <p className="text-lg font-semibold text-zinc-900">{sales.length}건</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">일시</th>
              <th className="px-3 py-2">결제수단</th>
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
                <td className="px-3 py-2">
                  {s.total_amount.toLocaleString()}원
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
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
