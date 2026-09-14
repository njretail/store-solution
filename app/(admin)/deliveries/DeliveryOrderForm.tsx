"use client";

import { useActionState, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { createDeliveryOrder, type DeliveryOrderState } from "./actions";
import { PAYMENT_METHODS, type CartItem, type Product } from "@/lib/types";

const initialState: DeliveryOrderState = { error: null, success: null };

export default function DeliveryOrderForm({
  storeId,
  defaultDeliveryFee,
  freeShippingThreshold,
}: {
  storeId: string;
  defaultDeliveryFee: number;
  freeShippingThreshold: number | null;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [state, formAction, pending] = useActionState(createDeliveryOrder, initialState);

  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setCart([]);
      setAddress("");
      setPhone("");
      setMemo("");
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
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.product.sell_price * i.quantity, 0),
    [cart]
  );
  const isFreeShipping =
    freeShippingThreshold != null && subtotal >= freeShippingThreshold;
  const deliveryFee = isFreeShipping ? 0 : defaultDeliveryFee;
  const total = subtotal + deliveryFee;

  const itemsJson = useMemo(
    () =>
      JSON.stringify(cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }))),
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
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            추가
          </button>
        </form>

        {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

        {cart.length > 0 && (
          <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {cart.map((item) => (
              <li key={item.product.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm text-zinc-900">{item.product.name}</p>
                  <p className="text-xs text-zinc-400">{item.product.sell_price.toLocaleString()}원</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(item.product.id, -1)}
                    className="h-6 w-6 rounded border border-zinc-300 text-zinc-600"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
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
      </div>

      <div className="flex w-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 lg:w-96">
        <h2 className="text-sm font-medium text-zinc-700">배송정보</h2>

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="배송지 주소 (필수)"
          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="연락처 (선택)"
          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="요청사항 (선택)"
          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />

        <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 text-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span>상품 합계</span>
            <span>{subtotal.toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500">
            <span>배송비</span>
            <span>
              {isFreeShipping ? (
                <>
                  <span className="text-zinc-400 line-through">
                    {defaultDeliveryFee.toLocaleString()}원
                  </span>{" "}
                  <span className="font-medium text-green-600">무료</span>
                </>
              ) : (
                `${deliveryFee.toLocaleString()}원`
              )}
            </span>
          </div>
          <div className="flex items-center justify-between font-medium text-zinc-900">
            <span>결제 예정 금액</span>
            <span>{total.toLocaleString()}원</span>
          </div>
          {freeShippingThreshold != null && !isFreeShipping && (
            <p className="text-xs text-zinc-400">
              {(freeShippingThreshold - subtotal).toLocaleString()}원 더 담으면 무료배송이에요.
            </p>
          )}
        </div>

        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="store_id" value={storeId} />
          <input type="hidden" name="items" value={itemsJson} />
          <input type="hidden" name="delivery_address" value={address} />
          <input type="hidden" name="delivery_phone" value={phone} />
          <input type="hidden" name="delivery_memo" value={memo} />
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

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">{state.success}</p>}

          <button
            type="submit"
            disabled={pending || cart.length === 0 || !address.trim()}
            className="rounded bg-[#C8075F] px-4 py-2 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {pending ? "등록 중..." : "배송주문 등록"}
          </button>
        </form>
      </div>
    </div>
  );
}
