import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all-pages";

export type AutoOrderCreated = { productId: string; productName: string; quantity: number };

// 이 매장에서 자동발주가 켜진 상품 중 재고가 적정재고(low_stock_threshold) 이하로
// 떨어진 상품을 찾아 본부(HQ) 발주를 자동 생성한다. 발주 수량은 적정재고 수량과
// 동일하게 맞춘다(재고를 적정 수준까지 채운다는 의미). 이미 대기중/발주완료 상태인
// 발주가 있으면 중복 생성하지 않는다. Vercel Cron(app/api/cron/auto-order)이
// 주기적으로 호출한다.
export async function runAutoOrderScan(
  supabase: SupabaseClient,
  storeId: string
): Promise<AutoOrderCreated[]> {
  const candidates = await fetchAllPages<{
    id: string;
    name: string;
    stock_qty: number;
    low_stock_threshold: number;
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, name, stock_qty, low_stock_threshold")
      .eq("store_id", storeId)
      .eq("auto_order_enabled", true)
      .range(from, to)
  );

  const lowStock = candidates.filter((p) => p.stock_qty <= p.low_stock_threshold);
  if (lowStock.length === 0) return [];

  const { data: openOrders } = await supabase
    .from("purchase_orders")
    .select("product_id")
    .eq("store_id", storeId)
    .in("status", ["pending", "ordered"]);

  const openProductIds = new Set((openOrders ?? []).map((o) => o.product_id as string));
  const toOrder = lowStock.filter((p) => !openProductIds.has(p.id));
  if (toOrder.length === 0) return [];

  const insertRows = toOrder.map((p) => ({
    store_id: storeId,
    product_id: p.id,
    quantity: Math.max(1, p.low_stock_threshold),
    channel: "hq" as const,
    source: "auto" as const,
    status: "pending" as const,
  }));

  const { error } = await supabase.from("purchase_orders").insert(insertRows);
  if (error) return [];

  return insertRows.map((r, i) => ({
    productId: r.product_id,
    productName: toOrder[i].name,
    quantity: r.quantity,
  }));
}
