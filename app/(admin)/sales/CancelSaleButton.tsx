"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSale } from "./actions";

export default function CancelSaleButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleCancel() {
    if (!confirm("이 판매를 취소할까요? 판매된 상품의 재고가 원래대로 복구됩니다.")) return;
    startTransition(async () => {
      const result = await cancelSale(saleId);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "취소 처리 중..." : "판매 취소"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
