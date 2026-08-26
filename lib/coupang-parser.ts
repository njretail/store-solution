export type ParsedRow = {
  name: string;
  orderQty: number;
  amount: number;
  packSize: number;
  pieceQty: number;
  unitCost: number;
  suggestedSellPrice: number;
};

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
