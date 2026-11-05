"use client";

import { useActionState, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import MarketingOptIn from "./MarketingOptIn";
import { checkout, type SellState } from "./actions";
import { createDeliveryOrder, type DeliveryOrderState } from "../deliveries/actions";
import { PAYMENT_METHODS, type CartItem, type Product } from "@/lib/types";

const initialState: SellState = { error: null, success: null };
const initialDeliveryState: DeliveryOrderState = { error: null, success: null };

type ReceiveMode = "pickup" | "delivery";

export default function SellPos({
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
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [state, formAction, pending] = useActionState(checkout, initialState);
  const [showOptIn, setShowOptIn] = useState(false);
  const [optInPhone, setOptInPhone] = useState("");

  // 배송으로 받기 — 같은 장바구니를 record_delivery_sale(배송주문건과 같은 경로)로 결제한다.
  const [receiveMode, setReceiveMode] = useState<ReceiveMode>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryMemo, setDeliveryMemo] = useState("");
  const [deliveryState, deliveryAction, deliveryPending] = useActionState(
    createDeliveryOrder,
    initialDeliveryState
  );
  // 배송 결제가 끝나면 "배송 상품은 배송공간으로" 안내를 닫을 때까지 크게 띄워둔다.
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  // 장바구니에는 행사가를 보여주지만, 배송 주문은 서버(record_delivery_sale)가 정가로
  // 계산하므로 배송비·무료배송 판단도 정가 기준으로 맞추려고 정가를 따로 기억해둔다.
  const [regularPrices, setRegularPrices] = useState<Record<string, number>>({});

  const [handledDeliverySuccess, setHandledDeliverySuccess] = useState(deliveryState.success);
  if (deliveryState.success !== handledDeliverySuccess) {
    setHandledDeliverySuccess(deliveryState.success);
    if (deliveryState.success) {
      setCart([]);
      setDeliveryAddress("");
      setDeliveryPhone("");
      setDeliveryMemo("");
      setReceiveMode("pickup");
      setDeliveryNotice(deliveryState.success);
    }
  }

  // 결제가 성공하면(액션 state가 바뀌면) 렌더 중에 장바구니를 비운다.
  // (useEffect에서 setState하면 불필요한 추가 렌더가 발생하므로 React가 권장하는 방식)
  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setCart([]);
      setCouponCode("");
      setDiscountAmount(0);
      setOptInPhone(customerPhone);
      setCustomerPhone("");
      setShowOptIn(true);
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

    const product = data as Product;
    setRegularPrices((prev) => ({ ...prev, [product.id]: product.sell_price }));
    // 기간한정 할인이 지금 걸려있으면 장바구니에 표시되는 가격도 실제 결제될
    // 할인가와 같게 보여준다(최종 계산은 record_sale이 서버에서 다시 하므로
    // 여기 표시는 참고용이지만, 다르게 보이면 직원이 혼란스러울 수 있음).
    const nowIso = new Date().toISOString();
    const { data: promo } = await supabase
      .from("promotions")
      .select("discount_type, discount_value")
      .eq("product_id", product.id)
      .eq("active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .maybeSingle();
    if (promo) {
      const discounted =
        promo.discount_type === "percent"
          ? Math.max(product.sell_price - Math.floor((product.sell_price * promo.discount_value) / 100), 0)
          : Math.max(product.sell_price - promo.discount_value, 0);
      product.sell_price = discounted;
    }

    addToCart(product);
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

  // 배송비 — record_delivery_sale과 같은 규칙(정가 합계가 무료배송 기준 이상이면 무료).
  const deliverySubtotal = cart.reduce(
    (sum, i) => sum + (regularPrices[i.product.id] ?? i.product.sell_price) * i.quantity,
    0
  );
  const isFreeShipping = freeShippingThreshold != null && deliverySubtotal >= freeShippingThreshold;
  const deliveryFee = isFreeShipping ? 0 : defaultDeliveryFee;
  const isDelivery = receiveMode === "delivery";

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

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
          {(
            [
              ["pickup", "지금 가져가기"],
              ["delivery", "배송으로 받기"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setReceiveMode(mode)}
              className={`rounded-md py-2 text-sm font-medium ${
                receiveMode === mode ? "bg-white text-[#C8075F] shadow-sm" : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isDelivery ? (
          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="배송지 (필수) 예: 래미안 103동 1204호"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
              placeholder="받는 분 연락처"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              value={deliveryMemo}
              onChange={(e) => setDeliveryMemo(e.target.value)}
              placeholder="요청사항 (선택) 예: 문 앞에 놓아 주세요"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <p className="text-xs text-zinc-400">
              배송 주문은 정가로 계산되며 행사가·쿠폰·고객 할인은 적용되지 않습니다.
            </p>
            <div className="flex flex-col gap-1 rounded-md bg-zinc-50 p-2 text-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span>상품 합계(정가)</span>
                <span>{deliverySubtotal.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>배송비</span>
                <span>
                  {isFreeShipping ? (
                    <span className="font-medium text-green-600">무료</span>
                  ) : (
                    `${deliveryFee.toLocaleString()}원`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium text-zinc-900">
                <span>결제 예정 금액</span>
                <span>{(deliverySubtotal + deliveryFee).toLocaleString()}원</span>
              </div>
              {freeShippingThreshold != null && !isFreeShipping && cart.length > 0 && (
                <p className="text-xs text-[#C8075F]">
                  {(freeShippingThreshold - deliverySubtotal).toLocaleString()}원 더 담으면 무료배송이에요.
                </p>
              )}
            </div>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800">
              📦 결제 후 배송 상품은 배송공간으로 옮겨 주세요.
            </p>
          </div>
        ) : (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <div>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="고객 전화번호 (선택, 적립/쿠폰 자동적용)"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-400">
              번호를 입력하면 신규 고객은 500원 즉시 할인, 기존 고객은 보유 쿠폰이 있으면 자동 적용됩니다.
            </p>
          </div>
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
        )}

        {!isDelivery && (
          <div className="flex items-center justify-between text-sm font-medium text-zinc-900">
            <span>상품 합계</span>
            <span>{total.toLocaleString()}원</span>
          </div>
        )}

        {isDelivery ? (
          <form action={deliveryAction} className="flex flex-col gap-2">
            <input type="hidden" name="store_id" value={storeId} />
            <input type="hidden" name="items" value={itemsJson} />
            <input type="hidden" name="delivery_address" value={deliveryAddress} />
            <input type="hidden" name="delivery_phone" value={deliveryPhone} />
            <input type="hidden" name="delivery_memo" value={deliveryMemo} />
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

            {deliveryState.error && (
              <p className="text-sm text-red-600">{deliveryState.error}</p>
            )}

            <button
              type="submit"
              disabled={deliveryPending || cart.length === 0 || !deliveryAddress.trim()}
              className="rounded bg-[#C8075F] px-4 py-2 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
            >
              {deliveryPending ? "처리 중..." : "배송으로 결제하기"}
            </button>
          </form>
        ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="items" value={itemsJson} />
          <input type="hidden" name="coupon_code" value={couponCode} />
          <input type="hidden" name="discount_amount" value={discountAmount} />
          <input type="hidden" name="customer_phone" value={customerPhone} />
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
        )}

        {showOptIn && (
          <MarketingOptIn defaultPhone={optInPhone} onClose={() => setShowOptIn(false)} />
        )}
      </div>

      {/* 배송 결제 완료 — 상품을 배송공간에 두지 않으면 배송이 안 되므로 닫을 때까지 크게 띄운다. */}
      {deliveryNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl">📦</div>
            <p className="text-2xl font-bold text-amber-900">
              배송 상품은 배송공간으로
              <br />
              옮겨 주세요
            </p>
            <p className="text-sm text-zinc-500">{deliveryNotice}</p>
            <button
              type="button"
              onClick={() => setDeliveryNotice(null)}
              className="w-full rounded-lg bg-[#C8075F] py-3 text-base font-semibold text-white hover:bg-[#a80650]"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
