"use client";

import { useActionState, useRef, useState } from "react";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { createProduct, createCategory, type ProductFormState } from "./actions";
import type { Category } from "@/lib/types";

const initialState: ProductFormState = { error: null, success: null };

export default function ProductForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const [barcode, setBarcode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const categoryDetailsRef = useRef<HTMLDetailsElement>(null);

  // 등록이 성공하면(액션 state가 바뀌면) 렌더 중에 바코드 입력을 초기화한다.
  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setBarcode("");
      setShowScanner(false);
    }
  }

  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-zinc-700">
        + 상품 추가
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="바코드 (직접 입력 또는 카메라 스캔)"
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowScanner((v) => !v)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              {showScanner ? "스캔 닫기" : "카메라로 스캔"}
            </button>
          </div>
          {showScanner && (
            <BarcodeScanner
              onDetect={(code) => {
                setBarcode(code);
                setShowScanner(false);
              }}
            />
          )}
        </div>

        <form
          action={formAction}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="barcode" value={barcode} />

          <input
            name="name"
            placeholder="상품명"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />

          <select
            name="category_id"
            defaultValue=""
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">분류 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            name="is_tax_exempt"
            defaultValue="false"
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="false">과세</option>
            <option value="true">면세</option>
          </select>

          <input
            name="sell_price"
            type="number"
            placeholder="판매가"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="cost_price"
            type="number"
            placeholder="입고가(원가)"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="initial_quantity"
            type="number"
            placeholder="입고 수량"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="low_stock_threshold"
            type="number"
            placeholder="재고부족 기준"
            defaultValue={5}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />

          <button
            type="submit"
            disabled={pending || !barcode}
            className="col-span-2 rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50 sm:col-span-3"
          >
            {pending ? "등록 중..." : "상품등록"}
          </button>

          {state.error && (
            <p className="col-span-full text-sm text-red-600">{state.error}</p>
          )}
          {state.success && (
            <p className="col-span-full text-sm text-green-600">{state.success}</p>
          )}
        </form>

        <details ref={categoryDetailsRef} className="w-fit">
          <summary className="cursor-pointer text-sm text-[#C8075F] underline">
            + 새 카테고리 추가
          </summary>
          <form
            action={async (formData) => {
              await createCategory(formData);
              categoryDetailsRef.current?.removeAttribute("open");
            }}
            className="mt-2 flex gap-2"
          >
            <input
              name="name"
              placeholder="카테고리명"
              required
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
            >
              추가
            </button>
          </form>
        </details>
      </div>
    </details>
  );
}
