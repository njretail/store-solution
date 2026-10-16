"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { transferStock, type StoreTransferState } from "./actions";
import { STOCK_TRANSFER_REASON_LABELS, type StockTransferReason } from "@/lib/types";

const initialState: StoreTransferState = { error: null, success: null };

type StoreLite = { id: string; name: string };
type StoreProduct = { id: string; store_id: string; name: string; stock_qty: number; sell_price: number; cost_price: number };
type ExpiryLot = { expiry_date: string; quantity: number };

// 바코드를 찍으면 매장별 재고·판매가를 한 번에 보여주고(어느 매장에 몇 개, 얼마에 팔리는지),
// 지금 매장에서 고른 매장으로 수량만큼 옮긴다.
export default function StoreTransferForm({ currentStore, stores }: { currentStore: StoreLite; stores: StoreLite[] }) {
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [byStore, setByStore] = useState<StoreProduct[] | null>(null);
  const [lots, setLots] = useState<ExpiryLot[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(transferStock, initialState);

  const source = byStore?.find((p) => p.store_id === currentStore.id) ?? null;
  const otherStores = stores.filter((s) => s.id !== currentStore.id);

  async function lookup(code: string) {
    setLookupError(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, store_id, name, stock_qty, sell_price, cost_price")
      .eq("barcode", code)
      .in(
        "store_id",
        stores.map((s) => s.id)
      );
    const rows = (data ?? []) as StoreProduct[];
    setBarcode(code);
    setByStore(rows);

    const mine = rows.find((p) => p.store_id === currentStore.id);
    if (mine) {
      const { data: lotData } = await supabase
        .from("product_expiries")
        .select("expiry_date, quantity")
        .eq("product_id", mine.id)
        .order("expiry_date");
      // 같은 날짜 묶음은 합쳐서 보여준다.
      const merged = new Map<string, number>();
      for (const l of (lotData ?? []) as ExpiryLot[]) merged.set(l.expiry_date, (merged.get(l.expiry_date) ?? 0) + l.quantity);
      setLots([...merged.entries()].map(([expiry_date, quantity]) => ({ expiry_date, quantity })));
    } else {
      setLots([]);
      setLookupError(
        rows.length > 0
          ? `${currentStore.name}에는 이 상품이 없어요. 상품이 있는 매장으로 전환한 뒤 옮겨주세요.`
          : `바코드 "${code}"에 해당하는 상품이 어느 매장에도 없습니다.`
      );
    }
  }

  // 이동이 끝나면 매장별 재고를 새로 불러온다.
  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success && barcode) void lookup(barcode);
  }

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

      {byStore && (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <p className="border-b border-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700">
            매장별 재고·가격 <span className="font-normal text-zinc-400">바코드 {barcode}</span>
          </p>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2">매장</th>
                <th className="px-4 py-2 text-right">재고</th>
                <th className="px-4 py-2 text-right">판매가</th>
                <th className="px-4 py-2 text-right">원가</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const p = byStore.find((x) => x.store_id === s.id);
                const isCurrent = s.id === currentStore.id;
                return (
                  <tr key={s.id} className={`border-t border-zinc-100 ${isCurrent ? "bg-[#C8075F]/5" : ""}`}>
                    <td className="px-4 py-2">
                      {s.name}
                      {isCurrent && <span className="ml-1 text-xs text-[#C8075F]">(보내는 매장)</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{p ? `${p.stock_qty.toLocaleString()}개` : "미등록"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p ? `${p.sell_price.toLocaleString()}원` : "-"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                      {p ? `${p.cost_price.toLocaleString()}원` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {source && (
        <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <input type="hidden" name="barcode" value={barcode} />
          <p className="text-sm font-medium text-zinc-900">
            {source.name} <span className="text-zinc-400">· {currentStore.name} 재고 {source.stock_qty}개</span>
          </p>

          {otherStores.length === 0 ? (
            <p className="text-sm text-zinc-500">옮길 수 있는 다른 매장이 없어요.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  받는 매장
                  <select name="to_store_id" required defaultValue="" className="rounded border border-zinc-300 px-2 py-2 text-sm text-zinc-900">
                    <option value="" disabled>
                      매장 선택
                    </option>
                    {otherStores.map((s) => {
                      const has = byStore?.some((p) => p.store_id === s.id);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {has ? "" : " (미등록 — 자동 등록됨)"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  이동 수량
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={source.stock_qty}
                    required
                    placeholder={`최대 ${source.stock_qty}개`}
                    className="rounded border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  사유
                  <select name="reason" defaultValue="expiry" className="rounded border border-zinc-300 px-2 py-2 text-sm text-zinc-900">
                    {(Object.keys(STOCK_TRANSFER_REASON_LABELS) as StockTransferReason[]).map((r) => (
                      <option key={r} value={r}>
                        {STOCK_TRANSFER_REASON_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  소비기한 함께 옮기기 (선택)
                  <select name="expiry_date" defaultValue="" className="rounded border border-zinc-300 px-2 py-2 text-sm text-zinc-900">
                    <option value="">옮기지 않음</option>
                    {lots.map((l) => (
                      <option key={l.expiry_date} value={l.expiry_date}>
                        {l.expiry_date} ({l.quantity}개)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input
                name="memo"
                placeholder="메모 (선택)"
                className="rounded border border-zinc-300 px-2 py-2 text-sm"
              />
              {state.error && <p className="text-sm text-red-600">{state.error}</p>}
              {state.success && <p className="text-sm text-green-600">{state.success}</p>}
              <button
                type="submit"
                disabled={pending || source.stock_qty <= 0}
                className="self-start rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
              >
                {pending ? "옮기는 중..." : "재고 옮기기"}
              </button>
            </>
          )}
        </form>
      )}

    </div>
  );
}
