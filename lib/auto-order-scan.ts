import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all-pages";

export type AutoOrderCreated = { productId: string; productName: string; quantity: number };

// 이 매장에서 자동발주가 켜진 상품 중 재고가 기준 이하로 떨어진 상품을 찾아
// 본부(HQ) 발주를 자동 생성한다. 이미 대기중/발주완료 상태인 발주가 있으면
// 중복 생성하지 않는다. Vercel Cron(app/api/cron/auto-order)이 주기적으로 호출한다.
export async function runAutoOrderScan(
  supabase: SupabaseClient,
  storeId: string
): Promise<AutoOrderCreated[]> {
  const candidates = await fetchAllPages<{
    id: string;
    name: string;
    stock_qty: number;
    low_stock_threshold: number;
    reorder_qty: number;
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, name, stock_qty, low_stock_threshold, reorder_qty")
      .eq("store_id", storeId)
      .eq("auto_order_enabled", true)
      .gt("reorder_qty", 0)
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

  const { error } = await supabase.from("purchase_orders").insert(
    toOrder.map((p) => ({
      store_id: storeId,
      product_id: p.id,
      quantity: p.reorder_qty,
      channel: "hq",
      source: "auto",
      status: "pending",
    }))
  );
  if (error) return [];

  return toOrder.map((p) => ({ productId: p.id, productName: p.name, quantity: p.reorder_qty }));
}
