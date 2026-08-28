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

type MatchableProduct = { id: string; name: string; barcode: string };

// 쿠팡 상품명(브랜드/용량/개수 등 부가 설명이 붙어 있음)과 우리 상품명을 비교하기 위해
// 공백/구두점을 제거하고 소문자로 정규화한다. 예: "오리온 아이셔 청사과맛, 42g, 24개" → "오리온아이셔청사과맛42g24개"
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s,()&/·\-_]/g, "")
    .trim();
}

// 파싱된 쿠팡 상품명을 기존 상품 목록과 이름으로 매칭한다.
// 쿠팡 상품명이 보통 우리 상품명보다 더 상세하므로(브랜드/용량 등 포함),
// 정규화한 우리 상품명이 정규화한 쿠팡 상품명에 포함되는지로 판단하고,
// 여러 개가 매칭되면 가장 긴(가장 구체적인) 이름을 우선한다.
export function matchProductByName(
  coupangName: string,
  products: MatchableProduct[]
): MatchableProduct | null {
  const target = normalizeName(coupangName);
  if (!target) return null;

  let best: MatchableProduct | null = null;
  let bestLen = 0;

  for (const p of products) {
    const candidate = normalizeName(p.name);
    if (candidate.length < 2) continue;

    const isMatch =
      target.includes(candidate) || candidate.includes(target);
    if (isMatch && candidate.length > bestLen) {
      best = p;
      bestLen = candidate.length;
    }
  }

  return best;
}

// 상품명에 포함된 마지막 "N개"를 낱개 묶음 수량(포장 단위)으로 사용한다.
// 예: "오리온 아이셔 츄잉캔디 청사과맛, 42g, 24개" → 24
export function extractPackSize(name: string): number {
  const matches = [...name.matchAll(/(\d+)\s*개/g)];
  if (matches.length === 0) return 1;
  return Number(matches[matches.length - 1][1]);
}

// 쿠팡 거래명세표 PDF에서 추출한 원문 텍스트를 파싱한다.
// 각 행은 "연도 4자리 + 월 2자리 + 일 2자리 + 상품명 + 수량 + 거래액(쉼표 포함)" 형태이며,
// 줄바꿈 보존 여부와 무관하게 동작하도록 다음 행의 날짜 패턴 또는 "총 거래액" 앞까지를
// 경계로 lookahead 처리한다.
export function parseCoupangText(
  text: string,
  marginPercent: number
): ParsedRow[] {
  const rowRegex =
    /(\d{4})\s+(\d{2})\s+(\d{2})\s+([\s\S]+?)\s+(\d+)\s+([\d,]+)(?=\s*(?:\d{4}\s+\d{2}\s+\d{2}\s+|총\s*거래액|$))/g;

  const rows: ParsedRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(text)) !== null) {
    const name = m[4].trim();
    const orderQty = Number(m[5]);
    const amount = Number(m[6].replace(/,/g, ""));
    if (!name || !orderQty || !amount) continue;

    const packSize = extractPackSize(name);
    const pieceQty = packSize * orderQty;
    const unitCost = pieceQty > 0 ? Math.round(amount / pieceQty) : amount;
    const suggestedSellPrice = Math.round(unitCost * (1 + marginPercent / 100));

    rows.push({ name, orderQty, amount, packSize, pieceQty, unitCost, suggestedSellPrice });
  }
  return rows;
}

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
function cellToBarcode(value: unknown): string {
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
