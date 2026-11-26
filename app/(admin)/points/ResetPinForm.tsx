"use client";

import { useActionState } from "react";
import { resetPointPin, type ResetPinState } from "./actions";
import { CUSTOMER_CENTER_LINE } from "@/lib/support";

/** 포인트 비밀번호 분실 시 관리자 초기화. customerId를 주면 고객 상세 화면용(번호 입력 없음). */
export default function ResetPinForm({ customerId, compact = false }: { customerId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<ResetPinState, FormData>(resetPointPin, { error: null, success: null });
  return (
    <form action={action} className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4"}>
      {!compact && (
        <>
          <h2 className="text-sm font-medium text-zinc-700">포인트 비밀번호 초기화 (분실 시)</h2>
          <p className="text-xs text-zinc-500">
            손님은 키오스크 안내를 보고 {CUSTOMER_CENTER_LINE}로 연락해요. 초기화해도 포인트는 그대로이고,
            손님이 다음에 포인트를 쓸 때 새 비밀번호를 정해요.
          </p>
        </>
      )}
      {customerId ? (
        <input type="hidden" name="customer_id" value={customerId} />
      ) : (
        <input name="phone" inputMode="numeric" placeholder="고객 휴대폰 번호" required className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
      )}
      <label className="flex items-start gap-2 text-xs text-zinc-600">
        <input type="checkbox" name="confirmed" className="mt-0.5 h-4 w-4 accent-[#C8075F]" />
        <span>
          손님 본인임을 확인했어요
          <span className="block text-zinc-400">예: 요청한 전화가 이 번호에서 걸려 왔거나, 이 번호로 카톡·문자를 받았음</span>
        </span>
      </label>
      <button disabled={pending} className="rounded border border-[#C8075F] px-3 py-1.5 text-sm font-medium text-[#C8075F] hover:bg-pink-50 disabled:opacity-50">
        {pending ? "처리 중..." : "비밀번호 초기화"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
