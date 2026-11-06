// 발주 수량 추천 — 자동으로 발주를 만들지 않고, 수량 칸에 추천값을 채워서 사장님이
// 확인하고 직접 "본부 발주"를 누르게 한다(자동발주는 물류창고 확보 전까지 숨김, lib/features.ts).
//
// 계산: 최근 SALES_WINDOW_DAYS일 하루 평균 판매량 × COVER_DAYS일치 − 현재 재고.
// 적정재고(low_stock_threshold)보다 적게는 추천하지 않는다 — 판매 기록이 없는 상품도
// 적정재고까지는 채우도록(기존 "부족분" 기본값과 같은 규칙).

export const SALES_WINDOW_DAYS = 30;
export const COVER_DAYS = 7;

export type OrderRecommendation = {
  quantity: number;
  // 화면에 그대로 보여줄 이유 문구
  reason: string;
};

export function recommendOrder(
  stockQty: number,
  lowStockThreshold: number,
  soldInWindow: number
): OrderRecommendation {
  const dailyAvg = soldInWindow / SALES_WINDOW_DAYS;
  const coverTarget = Math.ceil(dailyAvg * COVER_DAYS);
  const target = Math.max(lowStockThreshold, coverTarget);
  const quantity = Math.max(0, target - stockQty);

  let reason: string;
  if (soldInWindow <= 0) {
    reason = `최근 ${SALES_WINDOW_DAYS}일 판매 없음 · 적정재고 ${lowStockThreshold}개까지`;
  } else if (coverTarget >= lowStockThreshold) {
    const avg = dailyAvg >= 10 ? Math.round(dailyAvg).toString() : dailyAvg.toFixed(1);
    reason = `하루 평균 ${avg}개 팔림 · ${COVER_DAYS}일치 ${coverTarget}개 기준`;
  } else {
    reason = `판매가 적어 적정재고 ${lowStockThreshold}개까지`;
  }

  return { quantity, reason };
}

// top_products RPC 결과(product_id, quantity)를 상품별 판매 수량 지도로 바꾼다.
export function buildSoldQtyMap(ranked: Array<{ product_id: string; quantity: number | string }>) {
  const map = new Map<string, number>();
  for (const r of ranked) map.set(r.product_id, Number(r.quantity) || 0);
  return map;
}
