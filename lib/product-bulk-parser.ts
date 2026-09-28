import { cellToBarcode } from "./coupang-parser";

// 본사가 상품 카탈로그를 엑셀로 한 번에 등록할 때 쓰는 양식(상품 일괄 등록 화면)의 파서.
// null은 "엑셀에 값이 없음"을 뜻하고, 등록 시 그 컬럼은 건드리지 않는다(기존 상품을
// 갱신할 때 빈 칸이 기존 값을 지워버리지 않도록).
export type BulkProductRow = {
  barcode: string;
  name: string;
  category: string | null;
  sell_price: number;
  cost_price: number | null;
  is_tax_exempt: boolean | null;
  low_stock_threshold: number | null;
};

export type BulkParseResult = {
  rows: BulkProductRow[];
  errors: string[];
  skippedDuplicates: number;
};

export const MAX_BULK_PRODUCTS = 10000;
const MAX_ERRORS = 30;

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value ?? "").replace(/[,\s원]/g, "");
  return s === "" ? NaN : Number(s);
}

export function parseProductRows(rows: unknown[][]): BulkParseResult {
  const fail = (message: string): BulkParseResult => ({
    rows: [],
    errors: [message],
    skippedDuplicates: 0,
  });

  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    if (cells.some((c) => c.includes("바코드")) && cells.some((c) => c.includes("상품명"))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return fail("바코드번호/상품명 컬럼이 있는 머리글 행을 찾지 못했습니다.");

  const header = rows[headerRow].map((h) => String(h ?? "").trim());
  const idx = (...labels: string[]) => header.findIndex((h) => labels.some((l) => h.includes(l)));
  const barcodeIdx = idx("바코드");
  const nameIdx = idx("상품명");
  const categoryIdx = idx("카테고리", "분류");
  const sellIdx = idx("판매가", "판매단가");
  const costIdx = idx("입고가", "공급가", "원가", "매입가");
  const taxIdx = idx("과세");
  const thresholdIdx = idx("적정재고", "재고부족", "기준재고");
  if (sellIdx === -1) return fail("판매가 컬럼이 필요합니다.");

  const result: BulkProductRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skippedDuplicates = 0;
  const addError = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message);
  };

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const barcode = cellToBarcode(row[barcodeIdx]);
    const name = String(row[nameIdx] ?? "").trim();
    if (!barcode && !name) continue;

    if (!barcode) {
      addError(`${line}행(${name}): 바코드가 비어 있습니다.`);
      continue;
    }
    if (!name) {
      addError(`${line}행(${barcode}): 상품명이 비어 있습니다.`);
      continue;
    }

    const sell = toNumber(row[sellIdx]);
    if (!Number.isFinite(sell) || sell <= 0) {
      addError(`${line}행(${name}): 판매가를 확인하세요.`);
      continue;
    }

    let cost: number | null = null;
    if (costIdx !== -1) {
      const raw = toNumber(row[costIdx]);
      if (Number.isFinite(raw)) {
        if (raw < 0) {
          addError(`${line}행(${name}): 입고가가 음수입니다.`);
          continue;
        }
        cost = raw;
      }
    }

    let threshold: number | null = null;
    if (thresholdIdx !== -1) {
      const raw = toNumber(row[thresholdIdx]);
      if (Number.isFinite(raw)) {
        if (raw < 0) {
          addError(`${line}행(${name}): 적정재고가 음수입니다.`);
          continue;
        }
        threshold = Math.round(raw);
      }
    }

    let taxExempt: boolean | null = null;
    if (taxIdx !== -1) {
      const label = String(row[taxIdx] ?? "").trim();
      if (label === "면세") taxExempt = true;
      else if (label === "과세") taxExempt = false;
    }

    if (seen.has(barcode)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(barcode);

    const category = categoryIdx !== -1 ? String(row[categoryIdx] ?? "").trim() : "";
    result.push({
      barcode,
      name,
      category: category || null,
      sell_price: Math.round(sell),
      cost_price: cost === null ? null : Math.round(cost),
      is_tax_exempt: taxExempt,
      low_stock_threshold: threshold,
    });
  }

  if (result.length > MAX_BULK_PRODUCTS) {
    return fail(`한 번에 ${MAX_BULK_PRODUCTS.toLocaleString()}개까지 등록할 수 있습니다.`);
  }

  return { rows: result, errors, skippedDuplicates };
}
