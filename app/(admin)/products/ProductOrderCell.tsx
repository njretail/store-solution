"use client";

import { useActionState, useState } from "react";
import { createHqOrder, type OrderActionState } from "@/app/(admin)/purchase-orders/actions";

const initialOrderState: OrderActionState = { error: null };

// 상품 조회 화면 상단의 "전체 발주" 버튼이 참조하는 폼 id. 여러 상품의 발주선택
// 체크박스 + 수량이 전부 이 폼 하나로 들어가 한 번에 제출된다.
export const BULK_HQ_ORDER_FORM_ID = "bulk-hq-order-form";

export default function ProductOrderCell({
  productId,
  recommendedQty,
  recommendReason,
}: {
  productId: string;
  // 발주 수량 추천값(lib/order-recommendation.ts) — 수량 칸 기본값으로 쓴다.
  // 이미 충분하면 0이라 발주 버튼이 비활성화된 채로 시작한다.
  recommendedQty: number;
  recommendReason: string;
}) {
  const [qty, setQty] = useState(recommendedQty);

  const [hqState, hqAction, hqPending] = useActionState(createHqOrder, initialOrderState);

  const hqFormId = `hq-order-${productId}`;

  return (
    <div className="flex flex-col gap-1 py-1">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold ${
            recommendedQty > 0 ? "bg-[#C8075F]/10 text-[#C8075F]" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {recommendedQty > 0 ? `추천 ${recommendedQty}개` : "발주 불필요"}
        </span>
        <span>{recommendReason}</span>
        {qty !== recommendedQty && (
          <button
            type="button"
            onClick={() => setQty(recommendedQty)}
            className="text-[#C8075F] underline hover:no-underline"
          >
            추천값으로
          </button>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1" title="전체 발주에 이 상품을 포함">
          <input
            type="checkbox"
            form={BULK_HQ_ORDER_FORM_ID}
            name="bulk_order_ids"
            value={productId}
            className="h-3.5 w-3.5 rounded border-zinc-300"
          />
          <input type="hidden" form={BULK_HQ_ORDER_FORM_ID} name={`bulk_qty_${productId}`} value={qty} />
        </label>
        <input
          type="number"
          min={1}
          value={qty}
          data-order-qty-input
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          onKeyDown={(e) => {
            // 엔터 = 발주가 아니라 바로 아래 행의 수량칸으로 이동. 여러 상품 수량을
            // 쭉 훑으며 입력하고, 발주는 각 행의 버튼을 눌러 따로 확정한다.
            if (e.key === "Enter") {
              e.preventDefault();
              const inputs = Array.from(
                document.querySelectorAll<HTMLInputElement>("[data-order-qty-input]")
              );
              const idx = inputs.indexOf(e.currentTarget);
              const next = inputs[idx + 1];
              next?.focus();
              next?.select();
            }
          }}
          title="엔터를 누르면 아래 상품의 수량 입력칸으로 이동해요"
          className="w-16 rounded border border-zinc-300 px-1.5 py-1"
          placeholder="수량"
        />
        <form id={hqFormId} action={hqAction}>
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
      </div>

      {hqState.error && <p className="text-xs text-red-600">{hqState.error}</p>}
    </div>
  );
}
