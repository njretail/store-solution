import { requireProfile, getCurrentStore } from "@/lib/session";
import { updateCashThreshold } from "./actions";
import CashForm from "./CashForm";
import type { CashTransaction } from "@/lib/types";

export default async function CashPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: cashSalesData }, { data: txData }] = await Promise.all([
    supabase
      .from("sales")
      .select("total_amount")
      .eq("store_id", store.id)
      .eq("payment_method", "cash"),
    supabase
      .from("cash_transactions")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const cashSalesTotal = (cashSalesData ?? []).reduce(
    (sum, r) => sum + r.total_amount,
    0
  );
  const transactions = (txData ?? []) as CashTransaction[];
  const deposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = cashSalesTotal + deposits - withdrawals;
  const isLow =
    store.cash_alert_threshold != null && balance < store.cash_alert_threshold;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">현금관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      {isLow && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ 현금 잔액이 알림 기준(
          {store.cash_alert_threshold!.toLocaleString()}원) 아래로 떨어졌습니다.
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
        <p className="text-sm text-zinc-500">현재 현금 잔액</p>
        <p className="text-3xl font-semibold text-[#C8075F]">
          {balance.toLocaleString()}원
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          현금 매출 누적({cashSalesTotal.toLocaleString()}원) + 투입(
          {deposits.toLocaleString()}원) - 출금({withdrawals.toLocaleString()}원)
        </p>
      </div>

      <CashForm />

      {profile.role === "admin" && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            알림 기준 설정
          </summary>
          <form
            action={updateCashThreshold}
            className="mt-3 flex items-center gap-2"
          >
            <input
              name="cash_alert_threshold"
              type="number"
              placeholder="예: 50000"
              defaultValue={store.cash_alert_threshold ?? ""}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              저장
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            잔액이 이 금액 아래로 떨어지면 이 페이지와 홈 화면에 알림 배너가
            표시됩니다.
          </p>
        </details>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">최근 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">일시</th>
                <th className="px-4 py-3">구분</th>
                <th className="px-4 py-3">금액</th>
                <th className="px-4 py-3">메모</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(t.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td
                    className={`px-4 py-3 ${t.type === "deposit" ? "text-green-600" : "text-red-600"}`}
                  >
                    {t.type === "deposit" ? "투입" : "출금"}
                  </td>
                  <td className="px-4 py-3">{t.amount.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-zinc-500">{t.memo ?? "-"}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    등록된 현금 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
