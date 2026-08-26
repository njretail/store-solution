"use client";

import { useActionState, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { checkout, type SellState } from "./actions";
import { PAYMENT_METHODS, type CartItem, type Product } from "@/lib/types";

const initialState: SellState = { error: null, success: null };

export default function SellPos({ storeId }: { storeId: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [state, formAction, pending] = useActionState(checkout, initialState);

  // 결제가 성공하면(액션 state가 바뀌면) 렌더 중에 장바구니를 비운다.
  // (useEffect에서 setState하면 불필요한 추가 렌더가 발생하므로 React가 권장하는 방식)
  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setCart([]);
      setCouponCode("");
      setDiscountAmount(0);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  async function addByBarcode(code: string) {
    setLookupError(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("barcode", code)
      .maybeSingle();

    if (!data) {
      setLookupError(`바코드 "${code}"에 해당하는 상품이 없습니다.`);
      return;
    }
    addToCart(data as Product);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.product.sell_price * i.quantity, 0),
    [cart]
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }))
      ),
    [cart]
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <BarcodeScanner onDetect={addByBarcode} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualBarcode.trim()) {
              addByBarcode(manualBarcode.trim());
              setManualBarcode("");
            }
          }}
          className="flex gap-2"
        >
          <input
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="바코드 직접 입력"
            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          >
            추가
          </button>
        </form>

        {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}
      </div>

      <div className="flex w-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 lg:w-96">
        <h2 className="text-sm font-medium text-zinc-700">장바구니</h2>

        {cart.length === 0 ? (
          <p className="text-sm text-zinc-400">
            스캔하거나 바코드를 입력하세요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {cart.map((item) => (
              <li
                key={item.product.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex-1">
                  <p className="text-sm text-zinc-900">{item.product.name}</p>
                  <p className="text-xs text-zinc-400">
                    {item.product.sell_price.toLocaleString()}원
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(item.product.id, -1)}
                    className="h-6 w-6 rounded border border-zinc-300 text-zinc-600"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQty(item.product.id, 1)}
                    className="h-6 w-6 rounded border border-zinc-300 text-zinc-600"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.product.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <div className="flex items-center gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="쿠폰 코드 (선택)"
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm uppercase"
            />
            <input
              value={discountAmount || ""}
              onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
              type="number"
              min={0}
              placeholder="추가 할인(원)"
              className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <p className="text-xs text-zinc-400">
            쿠폰 유효성/정률 할인은 결제 시 서버에서 계산돼 최종 금액에 반영됩니다.
          </p>
        </div>

        <div className="flex items-center justify-between text-sm font-medium text-zinc-900">
          <span>상품 합계</span>
          <span>{total.toLocaleString()}원</span>
        </div>

        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="items" value={itemsJson} />
          <input type="hidden" name="coupon_code" value={couponCode} />
          <input type="hidden" name="discount_amount" value={discountAmount} />
          <select
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-green-600">{state.success}</p>
          )}

          <button
            type="submit"
            disabled={pending || cart.length === 0}
            className="rounded bg-[#C8075F] px-4 py-2 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {pending ? "처리 중..." : "결제하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
