"use client";

import { useActionState, useState } from "react";
import { optInMarketing, type MarketingOptInState } from "./actions";

const initialState: MarketingOptInState = { error: null, success: null };

export default function MarketingOptIn({
  defaultPhone,
  onClose,
}: {
  defaultPhone: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(optInMarketing, initialState);
  const [consent, setConsent] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  if (state.success) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-700">{state.success}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-fit rounded border border-green-300 px-3 py-1 text-xs text-green-700 hover:bg-green-100"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700">
          마케팅 소식을 받아보시겠어요? 번호를 남겨주시면 쿠폰을 드려요.
        </p>
        <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">
          나중에
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-2">
        <input
          name="phone"
          defaultValue={defaultPhone}
          placeholder="010-0000-0000"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />

        <button
          type="button"
          onClick={() => setShowNotice((v) => !v)}
          className="w-fit text-xs text-zinc-500 underline"
        >
          {showNotice ? "개인정보 수집·이용 동의 내용 닫기" : "개인정보 수집·이용 동의 내용 보기"}
        </button>
        {showNotice && (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500">
            <p>· 수집 항목: 휴대전화번호</p>
            <p>· 수집 목적: 신규 소식·할인 등 마케팅 정보 안내, 쿠폰 발급</p>
            <p>· 보유·이용 기간: 동의 철회 시 또는 수집일로부터 3년</p>
            <p>· 동의를 거부할 권리가 있으며, 거부해도 매장 이용에는 제한이 없습니다(다만 쿠폰은 발급되지 않습니다).</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          위 내용에 동의합니다
        </label>
        <input type="hidden" name="consent" value={String(consent)} />

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending || !consent}
          className="rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "처리 중..." : "동의하고 쿠폰 받기"}
        </button>
      </form>
    </div>
  );
}
