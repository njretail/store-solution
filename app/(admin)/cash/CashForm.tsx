"use client";

import { useActionState, useMemo, useState } from "react";
import { recordCashTransaction, type CashState } from "./actions";

const initialState: CashState = { error: null, success: null };

const DENOMINATIONS = [50000, 10000, 5000, 1000, 500, 100, 50, 10];

function denomLabel(v: number) {
  return v >= 1000 ? `${(v / 1000).toLocaleString()},000원권` : `${v}원`;
}

export default function CashForm() {
  const [state, formAction, pending] = useActionState(recordCashTransaction, initialState);
  const [type, setType] = useState("deposit");
  const [useDenoms, setUseDenoms] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [manualAmount, setManualAmount] = useState("");

  const denomTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0),
    [counts]
  );

  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setCounts({});
      setManualAmount("");
    }
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">구분</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="deposit">현금 투입</option>
            <option value="withdrawal">현금 출금</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">금액</label>
          <input
            name="amount"
            type="number"
            min={1}
            required
            readOnly={useDenoms}
            value={useDenoms ? denomTotal : manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="금액"
            className={`w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm ${
              useDenoms ? "bg-zinc-50 text-zinc-500" : ""
            }`}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">메모 (선택)</label>
          <input
            name="memo"
            placeholder="메모"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending || (useDenoms && denomTotal <= 0)}
          className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "처리 중..." : "등록"}
        </button>
      </div>

      <input type="hidden" name="denominations" value={useDenoms ? JSON.stringify(counts) : ""} />

      <label className="flex w-fit items-center gap-1.5 text-xs text-zinc-500">
        <input
          type="checkbox"
          checked={useDenoms}
          onChange={(e) => setUseDenoms(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-zinc-300"
        />
        권종별로 입력 (실제 세는 지폐/동전 매수 기준으로 금액을 자동 계산)
      </label>

      {useDenoms && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-4">
          {DENOMINATIONS.map((d) => (
            <div key={d} className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{denomLabel(d)}</label>
              <input
                type="number"
                min={0}
                value={counts[d] ?? ""}
                onChange={(e) =>
                  setCounts((prev) => ({ ...prev, [d]: Number(e.target.value) || 0 }))
                }
                placeholder="0"
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
