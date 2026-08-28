"use client";

import { useActionState, useRef, useState } from "react";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import {
  confirmPurchaseImport,
  type ParseState,
  type ConfirmState,
  type ConfirmItem,
} from "@/app/(admin)/purchase-import/actions";

const confirmInitial: ConfirmState = { error: null, success: null };

type ProductOption = { id: string; name: string; barcode: string };

type EditableRow = {
  key: string;
  name: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
  mode: "new" | "existing";
  product_id: string;
  barcode: string;
  is_tax_exempt: boolean;
  matchedProductName?: string;
};

export default function PurchaseImportForm({
  marginPercent,
  products,
  parseAction,
  parseInitial,
  fileAccept,
  fileLabel,
}: {
  marginPercent: number;
  products: ProductOption[];
  parseAction: (prevState: ParseState, formData: FormData) => Promise<ParseState>;
  parseInitial: ParseState;
  fileAccept: string;
  fileLabel: string;
}) {
  const [parseState, parseActionState, parsing] = useActionState(parseAction, parseInitial);
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmPurchaseImport,
    confirmInitial
  );
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [scanningKey, setScanningKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // 새로 파싱된 결과가 도착하면(액션 state가 바뀌면) 렌더 중에 검토용 편집 상태를 채운다.
  const [handledParse, setHandledParse] = useState(parseState);
  if (parseState !== handledParse) {
    setHandledParse(parseState);
    if (parseState.rows.length > 0) {
      setRows(
        parseState.rows.map((r, i) => ({
          key: `${i}-${r.name}`,
          name: r.cleanName ?? r.name,
          quantity: r.pieceQty,
          cost_price: r.unitCost,
          sell_price: r.suggestedSellPrice,
          mode: r.matchedProductId ? ("existing" as const) : ("new" as const),
          product_id: r.matchedProductId ?? "",
          barcode: r.barcode ?? "",
          is_tax_exempt: r.isTaxExempt ?? false,
          matchedProductName: r.matchedProductName,
        }))
      );
    }
  }

  // 등록이 성공하면(액션 state가 바뀌면) 렌더 중에 검토 목록을 비운다.
  const [handledConfirmSuccess, setHandledConfirmSuccess] = useState(
    confirmState.success
  );
  if (confirmState.success !== handledConfirmSuccess) {
    setHandledConfirmSuccess(confirmState.success);
    if (confirmState.success) {
      setRows([]);
    }
  }

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const itemsJson = JSON.stringify(
    rows.map(
      (r): ConfirmItem => ({
        mode: r.mode,
        product_id: r.mode === "existing" ? r.product_id : undefined,
        barcode: r.mode === "new" ? r.barcode : undefined,
        name: r.name,
        cost_price: r.cost_price,
        sell_price: r.sell_price,
        quantity: r.quantity,
        is_tax_exempt: r.mode === "new" ? r.is_tax_exempt : undefined,
      })
    )
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        action={parseActionState}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">{fileLabel}</label>
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            accept={fileAccept}
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 text-zinc-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
            <span className={fileName ? "text-zinc-900" : "text-zinc-400"}>
              {fileName ?? `${fileLabel} 선택`}
            </span>
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">마진율(%)</label>
          <input
            name="margin_percent"
            type="number"
            defaultValue={marginPercent}
            className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={parsing}
          className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {parsing ? "분석 중..." : "분석하기"}
        </button>
        {parseState.error && (
          <p className="w-full text-sm text-red-600">{parseState.error}</p>
        )}
      </form>

      {rows.length > 0 && (
        <form action={confirmAction} className="flex flex-col gap-4">
          <input type="hidden" name="items" value={itemsJson} />
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">상품명</th>
                  <th className="px-3 py-2">낱개수량</th>
                  <th className="px-3 py-2">매입단가</th>
                  <th className="px-3 py-2">판매단가</th>
                  <th className="px-3 py-2">등록 방식</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-zinc-100 align-top">
                    <td className="max-w-xs whitespace-normal px-3 py-2">
                      {r.name}
                      {r.matchedProductName && (
                        <p className="mt-1 text-xs text-green-600">
                          ✓ 자동 매칭: {r.matchedProductName}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={r.quantity}
                        onChange={(e) =>
                          updateRow(r.key, { quantity: Number(e.target.value) || 0 })
                        }
                        className="w-20 rounded border border-zinc-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={r.cost_price}
                        onChange={(e) =>
                          updateRow(r.key, { cost_price: Number(e.target.value) || 0 })
                        }
                        className="w-24 rounded border border-zinc-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={r.sell_price}
                        onChange={(e) =>
                          updateRow(r.key, { sell_price: Number(e.target.value) || 0 })
                        }
                        className="w-24 rounded border border-zinc-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <select
                          value={r.mode}
                          onChange={(e) =>
                            updateRow(r.key, {
                              mode: e.target.value as "new" | "existing",
                            })
                          }
                          className="rounded border border-zinc-200 px-2 py-1"
                        >
                          <option value="new">신규 등록</option>
                          <option value="existing">기존 상품 매칭</option>
                        </select>
                        {r.mode === "new" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <input
                                placeholder="바코드"
                                value={r.barcode}
                                onChange={(e) =>
                                  updateRow(r.key, { barcode: e.target.value })
                                }
                                className="w-28 rounded border border-zinc-200 px-2 py-1"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setScanningKey(scanningKey === r.key ? null : r.key)
                                }
                                className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600"
                              >
                                스캔
                              </button>
                            </div>
                            <select
                              value={r.is_tax_exempt ? "exempt" : "taxable"}
                              onChange={(e) =>
                                updateRow(r.key, {
                                  is_tax_exempt: e.target.value === "exempt",
                                })
                              }
                              className="w-28 rounded border border-zinc-200 px-2 py-1"
                            >
                              <option value="taxable">과세</option>
                              <option value="exempt">면세</option>
                            </select>
                          </div>
                        ) : (
                          <select
                            value={r.product_id}
                            onChange={(e) =>
                              updateRow(r.key, { product_id: e.target.value })
                            }
                            className="w-40 rounded border border-zinc-200 px-2 py-1"
                          >
                            <option value="">상품 선택</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {scanningKey === r.key && (
                          <div className="w-48">
                            <BarcodeScanner
                              onDetect={(code) => {
                                updateRow(r.key, { barcode: code });
                                setScanningKey(null);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmState.error && (
            <p className="text-sm text-red-600">{confirmState.error}</p>
          )}
          {confirmState.success && (
            <p className="text-sm text-green-600">{confirmState.success}</p>
          )}

          <button
            type="submit"
            disabled={confirming}
            className="self-start rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
          >
            {confirming ? "등록 중..." : `매입 등록 확정 (${rows.length}건)`}
          </button>
        </form>
      )}
    </div>
  );
}
