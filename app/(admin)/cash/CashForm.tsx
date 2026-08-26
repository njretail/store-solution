"use client";

import { useActionState, useState } from "react";
import { recordCashTransaction, type CashState } from "./actions";

const initialState: CashState = { error: null, success: null };

export default function CashForm() {
  const [state, formAction, pending] = useActionState(
    recordCashTransaction,
    initialState
  );
  const [type, setType] = useState("deposit");

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
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
          placeholder="금액"
          className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm"
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
        disabled={pending}
        className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "처리 중..." : "등록"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="w-full text-sm text-green-600">{state.success}</p>
      )}
    </form>
  );
}
