"use client";

import { useActionState } from "react";
import { createTestUrgentAlert, type AlertTestState } from "./actions";

const initialState: AlertTestState = { error: null, success: null };

export default function TestAlertForm() {
  const [state, formAction, pending] = useActionState(createTestUrgentAlert, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select name="type" className="rounded border border-amber-300 bg-white px-2 py-1.5 text-sm">
          <option value="theft">도난·보안</option>
          <option value="fridge_power">냉장고 전원</option>
          <option value="other">기타 긴급</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? "보내는 중..." : "테스트 알림 보내기"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
