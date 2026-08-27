"use client";

import { useActionState, useRef, useState } from "react";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { createProduct, createCategory, type ProductFormState } from "./actions";
import type { Category } from "@/lib/types";

const initialState: ProductFormState = { error: null, success: null };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

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

  const inputClass =
    "w-full rounded border border-zinc-300 px-3 py-2 text-base";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex max-w-md flex-col gap-4">
        {/* 1. 바코드: 스캔 또는 직접 입력 */}
        <Field label="① 바코드">
          <div className="flex items-center gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="바코드 번호 직접 입력"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowScanner((v) => !v)}
              className="shrink-0 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              {showScanner ? "닫기" : "스캔"}
            </button>
          </div>
          {showScanner && (
            <div className="mt-2">
              <BarcodeScanner
                onDetect={(code) => {
                  setBarcode(code);
                  setShowScanner(false);
                }}
              />
            </div>
          )}
        </Field>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="barcode" value={barcode} />

          {/* 2. 상품 정보 */}
          <Field label="② 상품명">
            <input name="name" required className={inputClass} />
          </Field>

          <Field label="③ 카테고리">
            <select name="category_id" defaultValue="" className={inputClass}>
              <option value="">분류 없음</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="④ 과세여부">
            <select name="is_tax_exempt" defaultValue="false" className={inputClass}>
              <option value="false">과세</option>
              <option value="true">면세</option>
            </select>
          </Field>

          {/* 3. 입고 정보: 실제 물건을 받을 때 순서대로 */}
          <Field label="⑤ 입고가 (원가)">
            <input
              name="cost_price"
              type="number"
              defaultValue={0}
              className={inputClass}
            />
          </Field>

          <Field label="⑥ 입고 수량">
            <input
              name="initial_quantity"
              type="number"
              defaultValue={0}
              className={inputClass}
            />
          </Field>

          <Field label="⑦ 소비기한 (선택 — 입고 수량이 있을 때만 등록됨)">
            <input name="expiry_date" type="date" className={inputClass} />
          </Field>

          {/* 4. 판매 정보 */}
          <Field label="⑧ 판매가">
            <input
              name="sell_price"
              type="number"
              defaultValue={0}
              className={inputClass}
            />
          </Field>

          <Field label="⑨ 재고부족 기준">
            <input
              name="low_stock_threshold"
              type="number"
              defaultValue={5}
              className={inputClass}
            />
          </Field>

          <Field label="⑩ 상품 이미지 (선택)">
            <input
              name="image"
              type="file"
              accept="image/*"
              className="text-sm text-zinc-600"
            />
          </Field>

          <button
            type="submit"
            disabled={pending || !barcode}
            className="rounded bg-[#C8075F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {pending ? "등록 중..." : "상품등록"}
          </button>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && (
            <p className="text-sm text-green-600">{state.success}</p>
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
    </div>
  );
}
