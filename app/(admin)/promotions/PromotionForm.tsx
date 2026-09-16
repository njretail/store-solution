"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { createPromotion, type PromotionState } from "./actions";
import type { Product } from "@/lib/types";

const initialState: PromotionState = { error: null, success: null };

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromotionForm({ storeId }: { storeId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [state, formAction, pending] = useActionState(createPromotion, initialState);

  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setProduct(null);
      setManualBarcode("");
    }
  }

  async function lookup(code: string) {
    setLookupError(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("barcode", code)
      .maybeSingle();

    if (data) {
      setProduct(data as Product);
    } else {
      setProduct(null);
      setLookupError(`바코드 "${code}"에 해당하는 상품이 없습니다.`);
    }
  }

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 86400000);

  return (
    <div className="flex flex-col gap-4">
      <BarcodeScanner onDetect={lookup} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualBarcode.trim()) lookup(manualBarcode.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          placeholder="바코드 직접 입력"
          className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
          조회
        </button>
      </form>

      {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

      {product && (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <input type="hidden" name="product_id" value={product.id} />
          <p className="text-sm font-medium text-zinc-900">
            {product.name}{" "}
            <span className="text-zinc-400">현재 판매가 {product.sell_price.toLocaleString()}원</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <select
              name="discount_type"
              defaultValue="amount"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="amount">정액 할인(원)</option>
              <option value="percent">정률 할인(%)</option>
            </select>
            <input
              name="discount_value"
              type="number"
              min={1}
              required
              placeholder="할인 값"
              className="w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">시작 일시</label>
              <input
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(now)}
                required
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">종료 일시</label>
              <input
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(in7days)}
                required
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">{state.success}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {pending ? "등록 중..." : "기간한정 할인 등록"}
          </button>
        </form>
      )}
    </div>
  );
}
