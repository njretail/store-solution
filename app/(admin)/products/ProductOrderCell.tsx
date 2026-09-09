"use client";

import { useActionState, useEffect, useState } from "react";
import { createHqOrder, createCoupangOrder, type OrderActionState } from "@/app/(admin)/purchase-orders/actions";

const initialOrderState: OrderActionState = { error: null, link: null };

export default function ProductOrderCell({
  productId,
  productName,
  lowStockThreshold,
}: {
  productId: string;
  productName: string;
  lowStockThreshold: number;
}) {
  // 발주 수량은 적정재고 수량과 같게 잡는다 — 재고를 적정 수준까지 채운다는 의미.
  // 자동발주도 같은 값으로 주문하므로 여기서 보여주는 수량이 실제 자동발주량과 같다.
  const [qty, setQty] = useState(Math.max(1, lowStockThreshold));

  const [hqState, hqAction, hqPending] = useActionState(createHqOrder, initialOrderState);
  const [coupangState, coupangAction, coupangPending] = useActionState(
    createCoupangOrder,
    initialOrderState
  );

  const hqFormId = `hq-order-${productId}`;

  // 쿠팡 발주 액션이 딥링크를 반환하면 새 탭으로 열어 직원이 바로 검색/결제를 이어가게 한다.
  useEffect(() => {
    if (coupangState.link) {
      window.open(coupangState.link, "_blank", "noopener,noreferrer");
    }
  }, [coupangState.link]);

  return (
    <div className="flex flex-col gap-1 py-1">
      <p className="text-xs text-zinc-400">
        적정재고: {lowStockThreshold}개 (자동발주도 이 수량만큼 주문돼요)
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
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
        <form action={coupangAction}>
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="product_name" value={productName} />
          <input type="hidden" name="quantity" value={qty} />
          <button
            type="submit"
            disabled={coupangPending || qty <= 0}
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
          ⚠ 새 탭에서 상품을 찾아 결제를 완료해주세요. 바코드 연동이 안 돼 입고가 자동
          반영되지 않으니, 상품 도착 후 입고 등록에서 직접 등록해주세요.
        </p>
      )}
    </div>
  );
}
