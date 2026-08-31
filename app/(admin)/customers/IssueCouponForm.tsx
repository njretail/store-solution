"use client";

import { useActionState } from "react";
import { issueCoupon, type IssueCouponState } from "./actions";
import { CAMPAIGN_TYPE_LABELS, type CampaignType } from "@/lib/types";

const initial: IssueCouponState = { error: null, success: null };

export default function IssueCouponForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(issueCoupon, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <input type="hidden" name="customer_id" value={customerId} />
      <h3 className="text-sm font-medium text-zinc-700">타겟 쿠폰 발급</h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          캠페인 유형
          <select name="campaign_type" defaultValue="manual" className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900">
            {(Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[])
              .filter((k) => k !== "welcome")
              .map((k) => (
                <option key={k} value={k}>
                  {CAMPAIGN_TYPE_LABELS[k]}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          유효기간(일, 0=무제한)
          <input name="expires_in_days" type="number" min={0} defaultValue={7} className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        쿠폰명
        <input name="title" placeholder="예: 모닝커피 20% 할인" required className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          할인 방식
          <select name="discount_type" defaultValue="amount" className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900">
            <option value="amount">금액(원)</option>
            <option value="percent">비율(%)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          할인값
          <input name="discount_value" type="number" min={1} required className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "발급 중..." : "쿠폰 발급"}
      </button>
    </form>
  );
}
