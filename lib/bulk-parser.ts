export type ParsedRow = {
  name: string;
  orderQty: number;
  amount: number;
  packSize: number;
  pieceQty: number;
  unitCost: number;
  suggestedSellPrice: number;
  barcode?: string;
  cleanName?: string;
  isTaxExempt?: boolean;
  matchedProductId?: string;
  matchedProductName?: string;
};

// 상품명 끝에 붙은 마지막 "N개"(포장 단위)를 분리해서 순수 상품명만 남긴다.
// 예: "새우깡, 24개" → { packSize: 24, cleanName: "새우깡" }
// 신규 상품 등록 시에는 이 낱개 수량 표기 없이 상품명만 저장해야 하기 때문에 필요하다.
function extractPackInfo(name: string): { packSize: number; cleanName: string } {
  const matches = [...name.matchAll(/(\d+)\s*개/g)];
  if (matches.length === 0) return { packSize: 1, cleanName: name.trim() };

  const last = matches[matches.length - 1];
  const start = last.index ?? name.length;
  const withoutMatch = name.slice(0, start) + name.slice(start + last[0].length);
  const cleanName = withoutMatch.replace(/,\s*,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "").trim();

  return { packSize: Number(last[1]), cleanName: cleanName || name.trim() };
}

// 엑셀 셀 값을 바코드 문자열로 안전하게 변환한다.
// 바코드 컬럼이 "숫자" 서식으로 저장되어 있으면 xlsx가 JS 숫자로 돌려주는데,
// String()/toString()은 아주 큰 수에서 지수 표기(예: 8.80927e+12)로 바뀔 수 있어
// toFixed(0)로 항상 자릿수 그대로의 정수 문자열을 만든다.
export function cellToBarcode(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(0) : "";
  }
  return String(value ?? "").trim();
}

// 대량매입 엑셀(바코드번호/상품명/수량/거래액/과세여부 컬럼)을 파싱한다.
// sheet_to_json({ header: 1 })로 뽑은 2차원 배열을 받아 헤더 행에서 컬럼 위치를 찾고,
// 그 아래 데이터 행을 순회한다 — 컬럼 순서가 바뀌어도 헤더 텍스트로 찾으므로 안전하다.
export function parseBulkRows(rows: unknown[][], marginPercent: number): ParsedRow[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h ?? "").trim());
  const colIndex = (label: string) => header.findIndex((h) => h.includes(label));
  const barcodeIdx = colIndex("바코드");
  const nameIdx = colIndex("상품명");
  const qtyIdx = colIndex("수량");
  const amountIdx = colIndex("거래액");
  const taxIdx = colIndex("과세");
  if (nameIdx === -1 || qtyIdx === -1 || amountIdx === -1) return [];

  const result: ParsedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameIdx] ?? "").trim();
    const orderQty = Number(String(row[qtyIdx] ?? "").replace(/,/g, "")) || 0;
    const amount = Number(String(row[amountIdx] ?? "").replace(/[,\s]/g, "")) || 0;
    if (!name || !orderQty || !amount) continue;

    const barcode = barcodeIdx !== -1 ? cellToBarcode(row[barcodeIdx]) : "";
    const { packSize, cleanName } = extractPackInfo(name);
    const pieceQty = packSize * orderQty;
    const unitCost = pieceQty > 0 ? Math.round(amount / pieceQty) : amount;
    const suggestedSellPrice = Math.round(unitCost * (1 + marginPercent / 100));

    const taxLabel = taxIdx !== -1 ? String(row[taxIdx] ?? "").trim() : "";
    const isTaxExempt =
      taxLabel === "면세" ? true : taxLabel === "과세" ? false : undefined;

    result.push({
      name,
      orderQty,
      amount,
      packSize,
      pieceQty,
      unitCost,
      suggestedSellPrice,
      barcode: barcode || undefined,
      cleanName,
      isTaxExempt,
    });
  }
  return result;
}
