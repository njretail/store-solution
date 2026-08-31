"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runWinbackScanNow } from "./actions";

export default function WinbackScanButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleRun() {
    setMessage(null);
    startTransition(async () => {
      const result = await runWinbackScanNow();
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(
          result.issuedCount > 0
            ? `${result.issuedCount}명에게 자동 쿠폰을 발급했습니다.`
            : "지금 발급 대상인 고객이 없습니다."
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRun}
        disabled={pending}
        className="rounded border border-[#C8075F] px-3 py-1.5 text-sm font-medium text-[#C8075F] hover:bg-[#FDEEF4] disabled:opacity-50"
      >
        {pending ? "확인 중..." : "뜸해진 고객 지금 확인 + 자동 쿠폰 발급"}
      </button>
      {message && <p className="text-xs text-zinc-500">{message}</p>}
    </div>
  );
}
