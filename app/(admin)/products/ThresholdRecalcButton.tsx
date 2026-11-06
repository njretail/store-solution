"use client";

import { useActionState } from "react";
import { recalcThresholds, type ThresholdRecalcState } from "./actions";

const initialState: ThresholdRecalcState = { error: null, success: null };

// 적정재고를 최근 7일 판매량으로 지금 바로 다시 계산하는 버튼(매일 새벽 자동 계산과 같은 로직).
export default function ThresholdRecalcButton() {
  const [state, formAction, pending] = useActionState(recalcThresholds, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg border border-[#C8075F] px-3 py-1.5 text-sm font-medium text-[#C8075F] hover:bg-[#C8075F]/5 disabled:opacity-50"
      >
        {pending ? "계산 중..." : "적정재고 지금 다시 계산"}
      </button>
      {!pending && state.success && <p className="text-sm text-green-600">{state.success}</p>}
      {!pending && state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
