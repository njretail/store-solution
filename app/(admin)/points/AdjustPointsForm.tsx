"use client";

import { useActionState } from "react";
import { adjustPoints, type AdjustState } from "./actions";

/** 직접 지급·차감. customerId를 주면 고객 상세 화면용(번호 입력 없음). */
export default function AdjustPointsForm({ customerId }: { customerId?: string }) {
  const [state, action, pending] = useActionState<AdjustState, FormData>(adjustPoints, { error: null, success: null });
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-medium text-zinc-700">포인트 직접 지급·차감</h2>
      {customerId ? (
        <input type="hidden" name="customer_id" value={customerId} />
      ) : (
        <input name="phone" inputMode="numeric" placeholder="고객 휴대폰 번호" required className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
      )}
      <div className="flex gap-2">
        <select name="direction" className="rounded border border-zinc-300 px-2 py-1.5 text-sm">
          <option value="add">지급 (+)</option>
          <option value="sub">차감 (−)</option>
        </select>
        <input name="amount" inputMode="numeric" placeholder="포인트" required className="w-28 rounded border border-zinc-300 px-2 py-1.5 text-right text-sm" />
      </div>
      <input name="memo" placeholder="사유 (필수, 내역에 남아요)" required className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
      <button disabled={pending} className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50">
        {pending ? "처리 중..." : "적용"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <p className="text-xs text-zinc-400">차감은 유효기간이 빠른 포인트부터 깎이고, 보유한 만큼만 차감돼요.</p>
    </form>
  );
}
