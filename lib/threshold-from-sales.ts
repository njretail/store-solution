import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/fetch-all-pages";

// 적정재고 = "판매 통계상 매장에 늘 두었으면 좋은 수량". 최근 THRESHOLD_WINDOW_DAYS일
// 동안 실제로 팔린 수량(취소된 판매 제외)으로 상품별 적정재고(low_stock_threshold)를
// 다시 계산해서 반영한다. 매일 크론(app/api/cron/auto-order)과 상품 화면의
// "지금 다시 계산" 버튼이 이 함수를 같이 쓴다.
//
// 최근 기간에 한 번도 안 팔린 상품은 값을 바꾸지 않는다 — 0으로 만들면 재고가 0이 되어도
// 재고소진상품에 뜨지 않게 되고, 일시적으로 안 팔린 상품의 기준이 사라지기 때문이다.
export const THRESHOLD_WINDOW_DAYS = 7;

export type ThresholdRecalcResult = {
  updated: number;
  unchanged: number;
  noSales: number;
};

export async function recalcThresholdsFromSales(
  supabase: SupabaseClient,
  storeId: string
): Promise<ThresholdRecalcResult> {
  const since = new Date();
  since.setDate(since.getDate() - THRESHOLD_WINDOW_DAYS);

  type SoldRow = { product_id: string; quantity: number };
  const [soldRows, products] = await Promise.all([
    fetchAllPages<SoldRow>((from, to) =>
      supabase
        .from("sale_items")
        .select("product_id, quantity, sales!inner(status, created_at)")
        .eq("store_id", storeId)
        .eq("sales.status", "completed")
        .gte("sales.created_at", since.toISOString())
        .range(from, to)
        .then((res) => ({ data: res.data as unknown as SoldRow[] | null, error: res.error }))
    ),
    fetchAllPages<{ id: string; low_stock_threshold: number }>((from, to) =>
      supabase
        .from("products")
        .select("id, low_stock_threshold")
        .eq("store_id", storeId)
        .range(from, to)
        .then((res) => ({
          data: res.data as { id: string; low_stock_threshold: number }[] | null,
          error: res.error,
        }))
    ),
  ]);

  const soldMap = new Map<string, number>();
  for (const r of soldRows) soldMap.set(r.product_id, (soldMap.get(r.product_id) ?? 0) + r.quantity);

  // 같은 새 값끼리 묶어서 한 번에 업데이트한다(상품마다 따로 보내면 요청이 너무 많아짐).
  const byValue = new Map<number, string[]>();
  const result: ThresholdRecalcResult = { updated: 0, unchanged: 0, noSales: 0 };
  for (const p of products) {
    const sold = soldMap.get(p.id) ?? 0;
    if (sold <= 0) {
      result.noSales++;
      continue;
    }
    if (sold === p.low_stock_threshold) {
      result.unchanged++;
      continue;
    }
    if (!byValue.has(sold)) byValue.set(sold, []);
    byValue.get(sold)!.push(p.id);
  }

  const CHUNK = 200;
  for (const [value, ids] of byValue) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("products")
        .update({ low_stock_threshold: value })
        .eq("store_id", storeId)
        .in("id", chunk);
      if (error) throw new Error(`적정재고 반영 실패: ${error.message}`);
      result.updated += chunk.length;
    }
  }

  return result;
}
