"use client";

import { useActionState, useState } from "react";
import { createHqOrder, createCoupangOrder, type OrderActionState } from "@/app/(admin)/purchase-orders/actions";

const initialOrderState: OrderActionState = { error: null, link: null };

// 상품 조회 화면 상단의 "전체 발주" 버튼이 참조하는 폼 id. 여러 상품의 발주선택
// 체크박스 + 수량이 전부 이 폼 하나로 들어가 한 번에 제출된다.
export const BULK_HQ_ORDER_FORM_ID = "bulk-hq-order-form";

// 쿠팡 발주는 클릭하는 순간(사용자 동작 안에서) 쿠팡 메인을 새 탭으로 연다 — 서버 처리(발주 기록)가
// 끝난 뒤에 열면 브라우저가 팝업으로 보고 막아버린다. 발주 기록은 폼 제출로 그대로 남는다.
const COUPANG_MAIN_URL = "https://www.coupang.com/";

export default function ProductOrderCell({
  productId,
  productName,
  stockQty,
  lowStockThreshold,
}: {
  productId: string;
  productName: string;
  stockQty: number;
  lowStockThreshold: number;
}) {
  // 발주 수량 기본값은 부족분(적정재고 - 현재재고)만큼만 잡는다 — 이미 적정재고
  // 이상 있으면 0으로 시작해 발주 버튼이 비활성화된다(자동발주 로직과 동일한 규칙).
  const [qty, setQty] = useState(Math.max(0, lowStockThreshold - stockQty));

  const [hqState, hqAction, hqPending] = useActionState(createHqOrder, initialOrderState);
  const [coupangState, coupangAction, coupangPending] = useActionState(
    createCoupangOrder,
    initialOrderState
  );

  const hqFormId = `hq-order-${productId}`;


  return (
    <div className="flex flex-col gap-1 py-1">
      <p className="text-xs text-zinc-400">
        적정재고: {lowStockThreshold}개 · 부족분 {Math.max(0, lowStockThreshold - stockQty)}개까지 자동/기본 발주돼요
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
        <form
          action={coupangAction}
          onSubmit={() => {
            window.open(COUPANG_MAIN_URL, "_blank", "noopener,noreferrer");
          }}
        >
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
          ⚠ 새 탭에 열린 쿠팡에서 상품을 찾아 결제를 완료해주세요. 바코드 연동이 안 돼 입고가 자동
          반영되지 않으니, 상품 도착 후 입고 등록에서 직접 등록해주세요.
        </p>
      )}
    </div>
  );
}
