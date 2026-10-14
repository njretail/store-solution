"use client";

import { useState } from "react";

// 은행 앱에 붙여넣어 송금할 수 있게 "은행 계좌번호"를 복사한다.
export default function CopyAccountButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 화면의 번호를 직접 보고 입력하면 된다.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="계좌정보 복사"
      title="계좌정보 복사"
      className="rounded p-0.5 text-zinc-600 hover:bg-zinc-200"
    >
      {copied ? (
        <span className="text-xs text-green-700">복사됨</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
