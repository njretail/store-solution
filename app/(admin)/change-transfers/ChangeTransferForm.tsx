"use client";

import { useActionState, useState } from "react";
import { createChangeTransferRequest, type ChangeTransferState } from "./actions";

const initialState: ChangeTransferState = { error: null, success: null };

export default function ChangeTransferForm() {
  const [state, formAction, pending] = useActionState(createChangeTransferRequest, initialState);
  const [open, setOpen] = useState(false);

  return (
    <details
      className="rounded-lg border border-zinc-200 bg-white p-4"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-zinc-700">
        거스름돈 계좌이체 요청 등록
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-zinc-400">
          거스름돈이 모자라 고객에게 현금으로 다 돌려주지 못했을 때, 고객 계좌 정보를 받아
          등록해두면 나중에 지급 처리를 추적할 수 있어요.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">고객명 (선택)</label>
            <input
              name="customer_name"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">연락처 (선택)</label>
            <input
              name="customer_phone"
              placeholder="010-0000-0000"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">은행명</label>
            <input
              name="bank_name"
              required
              placeholder="예: 국민은행"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">계좌번호</label>
            <input
              name="account_number"
              required
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">예금주</label>
            <input
              name="account_holder"
              required
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">이체할 금액</label>
            <input
              name="amount"
              type="number"
              min={1}
              required
              placeholder="예: 1500"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">메모 (선택)</label>
          <input name="memo" className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {pending ? "등록 중..." : "등록"}
          </button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">{state.success}</p>}
        </div>
      </form>
    </details>
  );
}
