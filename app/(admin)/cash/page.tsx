import { requireProfile, getCurrentStore } from "@/lib/session";
import { updateCashThreshold, updateChangeThreshold } from "./actions";
import CashForm from "./CashForm";
import type { CashTransaction } from "@/lib/types";

// 거스름돈으로 쓰는 소액권(1,000원 이하) — 전체 현금 잔액과 별개로 이 권종들만
// 얼마나 남았는지 따로 추적해서, 잔돈이 떨어져 거스름돈을 못 주는 상황을 미리 안다.
const SMALL_DENOMINATIONS = [1000, 500, 100, 50, 10];

export default async function CashPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: cashSalesData }, { data: txData }, { data: allTxDenomData }] = await Promise.all([
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
    // 잔돈 추정치는 최근 30건이 아니라 전체 입출금 기록을 다 더해야 정확해서 따로 조회한다.
    supabase.from("cash_transactions").select("type, denominations").eq("store_id", store.id),
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

  // 권종별로 입력된 입출금 기록만 반영된다 — 판매(POS)로 나간 거스름돈은 권종 단위로
  // 기록되지 않으므로 이 숫자는 추정치다(입출금을 꼬박꼬박 권종별로 입력했다는 전제).
  // 금액이 아니라 "매수(개수)"로 본다 — 예를 들어 10원짜리 동전 50개는 500원이라
  // 금액으로는 작아 보여도, 실제로 거슬러 줄 수 있는 개수가 부족한 게 핵심이기 때문.
  const changeCount = (allTxDenomData ?? []).reduce((sum, t) => {
    if (!t.denominations) return sum;
    const count = SMALL_DENOMINATIONS.reduce(
      (s, d) => s + (Number(t.denominations?.[String(d)]) || 0),
      0
    );
    return sum + (t.type === "deposit" ? count : -count);
  }, 0);
  const isChangeLow =
    store.change_alert_threshold != null && changeCount <= store.change_alert_threshold;

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
      {isChangeLow && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ 거스름돈용 소액권(1,000원 이하) 추정 개수가 알림 기준(
          {store.change_alert_threshold!.toLocaleString()}매) 이하로 떨어졌습니다 — 잔돈을
          채워두거나, 거스름돈이 모자라면{" "}
          <a href="/change-transfers" className="font-medium underline">
            계좌이체요청내역
          </a>
          으로 처리하세요.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">거스름돈용 소액권 추정 개수</p>
          <p className="text-3xl font-semibold text-zinc-900">
            {changeCount.toLocaleString()}매
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            1,000원권 이하만 집계(동전·1천원권), 금액이 아니라 매수 기준 · 입출금을
            권종별로 입력한 기록 기준 추정치입니다(판매 중 나간 거스름돈은 권종 단위로
            기록되지 않음).
          </p>
        </div>
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
            <label className="text-xs text-zinc-500">전체 잔액</label>
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

          <form
            action={updateChangeThreshold}
            className="mt-3 flex items-center gap-2"
          >
            <label className="text-xs text-zinc-500">잔돈(소액권) 개수</label>
            <input
              name="change_alert_threshold"
              type="number"
              placeholder="예: 50"
              defaultValue={store.change_alert_threshold ?? ""}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-zinc-400">매 이하일 때</span>
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              저장
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            1,000원 이하 권종(동전·1천원권) 추정 개수가 이 매수 이하로 떨어지면
            알림이 표시됩니다(금액이 아니라 개수 기준). 입출금 등록 시 “권종별로
            입력”을 켜서 기록해야 정확해집니다.
          </p>
        </details>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">최근 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
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
                  <td className="px-4 py-3">
                    {t.amount.toLocaleString()}원
                    {t.denominations && (
                      <p className="whitespace-normal text-xs text-zinc-400">
                        {Object.entries(t.denominations)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([denom, count]) => `${Number(denom).toLocaleString()}원×${count}`)
                          .join(" · ")}
                      </p>
                    )}
                  </td>
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
