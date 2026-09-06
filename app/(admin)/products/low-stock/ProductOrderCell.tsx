"use client";

import { useActionState, useEffect, useState } from "react";
import { updateOrderSettings } from "../actions";
import { createHqOrder, createCoupangOrder, type OrderActionState } from "@/app/(admin)/purchase-orders/actions";

const initialOrderState: OrderActionState = { error: null, link: null };

export default function ProductOrderCell({
  productId,
  autoOrderEnabled,
  reorderQty,
  coupangProductUrl,
}: {
  productId: string;
  autoOrderEnabled: boolean;
  reorderQty: number;
  coupangProductUrl: string | null;
}) {
  const [autoOrder, setAutoOrder] = useState(autoOrderEnabled);
  const [qty, setQty] = useState(reorderQty || 1);
  const [coupangUrl, setCoupangUrl] = useState(coupangProductUrl ?? "");

  const [hqState, hqAction, hqPending] = useActionState(createHqOrder, initialOrderState);
  const [coupangState, coupangAction, coupangPending] = useActionState(
    createCoupangOrder,
    initialOrderState
  );

  // 쿠팡 발주 액션이 딥링크를 반환하면 새 탭으로 열어 직원이 바로 결제를 이어가게 한다.
  useEffect(() => {
    if (coupangState.link) {
      window.open(coupangState.link, "_blank", "noopener,noreferrer");
    }
  }, [coupangState.link]);

  return (
    <div className="flex flex-col gap-2 py-1">
      <form
        action={updateOrderSettings}
        className="flex flex-wrap items-center gap-2 text-xs"
      >
        <input type="hidden" name="id" value={productId} />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            name="auto_order_enabled"
            checked={autoOrder}
            onChange={(e) => setAutoOrder(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300"
          />
          자동발주
        </label>
        <input
          type="number"
          name="reorder_qty"
          min={0}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          className="w-16 rounded border border-zinc-300 px-1.5 py-1"
          placeholder="수량"
        />
        <input
          type="text"
          name="coupang_product_url"
          value={coupangUrl}
          onChange={(e) => setCoupangUrl(e.target.value)}
          placeholder="쿠팡 상품 URL"
          className="w-40 rounded border border-zinc-300 px-1.5 py-1"
        />
        <button
          type="submit"
          className="rounded border border-zinc-300 px-2 py-1 text-zinc-600 hover:bg-zinc-50"
        >
          설정 저장
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <form action={hqAction}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="quantity" value={qty} />
          <button
            type="submit"
            disabled={hqPending || qty <= 0}
            className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {hqPending ? "발주중..." : "본부 발주"}
          </button>
        </form>
        <form action={coupangAction}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="quantity" value={qty} />
          <input type="hidden" name="coupang_product_url" value={coupangUrl} />
          <button
            type="submit"
            disabled={coupangPending || qty <= 0 || !coupangUrl}
            className="rounded bg-orange-50 px-2 py-1 font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
          >
            {coupangPending ? "생성중..." : "쿠팡 발주"}
          </button>
        </form>
      </div>

      {(hqState.error || coupangState.error) && (
        <p className="text-xs text-red-600">{hqState.error ?? coupangState.error}</p>
      )}
      {coupangState.link && !coupangState.error && (
        <p className="text-xs text-amber-600">
          ⚠ 새 탭에서 결제를 완료해주세요. 바코드 연동이 안 돼 입고가 자동 반영되지 않으니,
          상품 도착 후 입고 등록에서 직접 등록해주세요.
        </p>
      )}
    </div>
  );
}
