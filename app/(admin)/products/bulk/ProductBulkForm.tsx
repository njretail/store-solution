"use client";

import { useActionState, useState } from "react";
import * as XLSX from "xlsx";
import {
  parseProductExcel,
  registerProducts,
  type BulkParseState,
  type BulkRegisterState,
} from "./actions";
import type { Store } from "@/lib/types";

const initialParse: BulkParseState = {
  error: null,
  rows: [],
  errors: [],
  skippedDuplicates: 0,
  impact: [],
  storeIds: [],
};
const initialRegister: BulkRegisterState = { error: null, success: null };

function downloadTemplate() {
  const header = ["바코드번호", "상품명", "카테고리", "판매가", "입고가", "과세여부", "적정재고"];
  const sheet = XLSX.utils.aoa_to_sheet([
    header,
    ["8801234567890", "예시 과자 90g", "과자", 1500, 1000, "과세", 5],
    ["8809876543210", "예시 생수 500ml", "음료", 800, 500, "면세", 10],
  ]);
  const guide = XLSX.utils.aoa_to_sheet([
    ["작성 방법"],
    ["1. 첫 번째 시트(상품양식)의 머리글 행은 그대로 두고, 2행부터 상품을 입력하세요."],
    ["2. 바코드번호와 상품명, 판매가는 필수입니다. 나머지 칸은 비워도 됩니다."],
    ["3. 카테고리는 공용 목록입니다. 목록에 없는 이름은 등록할 때 새로 만들어집니다."],
    ["4. 과세여부는 '과세' 또는 '면세'로 적고, 적정재고는 재고부족 기준 수량입니다."],
    ["5. 재고 수량은 이 양식으로 넣지 않습니다(신규 상품은 재고 0으로 등록되고 입고로 채웁니다)."],
    ["6. 바코드 칸은 '텍스트' 서식으로 두면 긴 숫자가 깨지지 않습니다."],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "상품양식");
  XLSX.utils.book_append_sheet(wb, guide, "작성방법");
  XLSX.writeFile(wb, "상품일괄등록_양식샘플.xlsx");
}

export default function ProductBulkForm({
  stores,
  currentStoreId,
}: {
  stores: Store[];
  currentStoreId: string;
}) {
  const [selected, setSelected] = useState<string[]>([currentStoreId]);
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [parseState, parseAction, parsing] = useActionState(parseProductExcel, initialParse);
  const [regState, regAction, registering] = useActionState(registerProducts, initialRegister);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const hasPreview = parseState.rows.length > 0;
  const stale = hasPreview && parseState.storeIds.join(",") !== [...selected].sort().join(",");
  const done = !!regState.success && !regState.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-zinc-700">1. 양식 받기</p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            양식 샘플 다운로드
          </button>
          <span className="text-xs text-zinc-400">
            바코드번호 · 상품명 · 카테고리 · 판매가 · 입고가 · 과세여부 · 적정재고
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700">2. 적용할 매장</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                {s.name}
              </label>
            ))}
            {stores.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelected(selected.length === stores.length ? [] : stores.map((s) => s.id))
                }
                className="text-xs text-[#C8075F] underline"
              >
                {selected.length === stores.length ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700">3. 이미 있는 바코드는 어떻게 할까요?</p>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="mode-ui"
              checked={mode === "skip"}
              onChange={() => setMode("skip")}
            />
            건너뛰기 — 신규 상품만 등록 (기존 가격 · 정보는 그대로)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="mode-ui"
              checked={mode === "update"}
              onChange={() => setMode("update")}
            />
            갱신 — 엑셀에 적힌 값으로 덮어쓰기 (빈 칸은 기존 값 유지, 재고는 건드리지 않음)
          </label>
        </div>

        <form action={parseAction} className="flex flex-col gap-2">
          {selected.map((id) => (
            <input key={id} type="hidden" name="store_ids" value={id} />
          ))}
          <p className="text-sm font-medium text-zinc-700">4. 엑셀 올리고 미리보기</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              required
              className="text-sm text-zinc-600"
            />
            <button
              type="submit"
              disabled={parsing || selected.length === 0}
              className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
            >
              {parsing ? "읽는 중..." : "미리보기"}
            </button>
          </div>
          {parseState.error && <p className="text-sm text-red-600">{parseState.error}</p>}
        </form>
      </div>

      {hasPreview && !done && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-700">
            5. 확인 후 등록 — 상품 {parseState.rows.length.toLocaleString()}개를 읽었어요
          </p>

          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">매장</th>
                  <th className="px-3 py-2">신규 등록</th>
                  <th className="px-3 py-2">이미 있는 바코드</th>
                </tr>
              </thead>
              <tbody>
                {parseState.impact.map((i) => (
                  <tr key={i.storeId} className="border-t border-zinc-100">
                    <td className="px-3 py-2">{i.storeName}</td>
                    <td className="px-3 py-2 font-medium text-green-700">
                      {i.newCount.toLocaleString()}개
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {i.existingCount.toLocaleString()}개 (
                      {mode === "update" ? "정보 갱신" : "건너뜀"})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(parseState.errors.length > 0 || parseState.skippedDuplicates > 0) && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {parseState.skippedDuplicates > 0 && (
                <p>엑셀 안에서 바코드가 겹친 {parseState.skippedDuplicates}행은 첫 번째만 사용해요.</p>
              )}
              {parseState.errors.length > 0 && (
                <>
                  <p className="font-medium">제외된 행 {parseState.errors.length}건 (수정 후 다시 올릴 수 있어요)</p>
                  <ul className="list-disc pl-5">
                    {parseState.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">바코드</th>
                  <th className="px-3 py-2">상품명</th>
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2">판매가</th>
                  <th className="px-3 py-2">입고가</th>
                  <th className="px-3 py-2">과세</th>
                  <th className="px-3 py-2">적정재고</th>
                </tr>
              </thead>
              <tbody>
                {parseState.rows.slice(0, 20).map((r) => (
                  <tr key={r.barcode} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-zinc-500">{r.barcode}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-zinc-500">{r.category ?? "-"}</td>
                    <td className="px-3 py-2">{r.sell_price.toLocaleString()}원</td>
                    <td className="px-3 py-2">
                      {r.cost_price === null ? "-" : `${r.cost_price.toLocaleString()}원`}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {r.is_tax_exempt === null ? "-" : r.is_tax_exempt ? "면세" : "과세"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{r.low_stock_threshold ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parseState.rows.length > 20 && (
            <p className="-mt-2 text-xs text-zinc-400">
              앞의 20개만 보여드려요. 등록은 읽은 {parseState.rows.length.toLocaleString()}개 전체가 대상입니다.
            </p>
          )}

          <form action={regAction} className="flex flex-col gap-2">
            <input type="hidden" name="rows" value={JSON.stringify(parseState.rows)} />
            <input type="hidden" name="mode" value={mode} />
            {selected.map((id) => (
              <input key={id} type="hidden" name="store_ids" value={id} />
            ))}
            {stale && (
              <p className="text-sm text-amber-700">
                적용 매장을 바꾸셨어요. 위의 미리보기를 다시 눌러 새 매장 기준으로 확인해주세요.
              </p>
            )}
            {regState.error && <p className="text-sm text-red-600">{regState.error}</p>}
            <p className="text-xs text-zinc-400">
              신규 상품은 재고 0으로 등록돼요. 재고는 입고나 대량매입으로 채워주세요.
            </p>
            <button
              type="submit"
              disabled={registering || stale || selected.length === 0}
              className="self-start rounded bg-[#C8075F] px-5 py-2 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
            >
              {registering
                ? "등록 중... (상품이 많으면 조금 걸려요)"
                : `${selected.length}개 매장에 등록하기`}
            </button>
          </form>
        </div>
      )}

      {done && (
        <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">등록이 완료되었습니다.</p>
          <ul className="list-disc pl-5">
            {regState.success!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="self-start text-xs text-green-700 underline"
          >
            다른 파일 올리기
          </button>
        </div>
      )}
    </div>
  );
}
