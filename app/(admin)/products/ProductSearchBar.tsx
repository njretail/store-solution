"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BarcodeScanner from "@/app/components/BarcodeScanner";

// 상품 조회 검색창 — 상품명/바코드 입력 검색 + 카메라로 바코드를 찍어 바로 검색.
// 바코드 스캐너(USB 리더기)는 키보드처럼 입력창에 번호를 넣고 엔터를 치므로 입력 검색으로 그대로 된다.
export default function ProductSearchBar({ q, sort, dir }: { q: string; sort: string; dir: string }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  function search(code: string) {
    const sp = new URLSearchParams({ sort, dir, q: code });
    setScanning(false);
    router.push(`/products?${sp.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input
          name="q"
          defaultValue={q}
          placeholder="상품명 또는 바코드로 검색"
          className="w-full max-w-sm rounded border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
          검색
        </button>
        <button
          type="button"
          onClick={() => setScanning((v) => !v)}
          className={`flex items-center gap-1 rounded border px-3 py-1.5 text-sm ${
            scanning ? "border-[#C8075F] bg-[#C8075F] text-white" : "border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8" strokeLinecap="round" />
          </svg>
          {scanning ? "스캔 닫기" : "바코드 스캔"}
        </button>
        {q && (
          <Link
            href="/products"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
          >
            초기화
          </Link>
        )}
      </form>
      {scanning && (
        <div className="max-w-sm">
          <BarcodeScanner onDetect={search} />
          <p className="mt-1 text-xs text-zinc-400">바코드를 카메라에 비추면 바로 검색돼요.</p>
        </div>
      )}
    </div>
  );
}
