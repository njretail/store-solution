import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all-pages";

export type AutoOrderCreated = { productId: string; productName: string; quantity: number };

// 이 매장에서 자동발주가 켜진 상품 중 재고가 기준 이하로 떨어진 상품을 찾아
// 본부(HQ) 발주를 자동 생성한다. 이미 대기중/발주완료 상태인 발주가 있으면
// 중복 생성하지 않는다. Vercel Cron(app/api/cron/auto-order)이 주기적으로 호출한다.
//
// 발주 수량은 고정값을 저장해두지 않고, 실행 시점 기준 최근 7일 판매량으로 매번
// 새로 계산한다("적정 발주수량") — 최근에 안 팔린 상품을 옛날 설정값으로 과다발주하는
// 일이 없도록. 최근 7일간 판매 기록이 없으면 최소 1개로 발주한다.
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

  const weekSales = await getWeekSoldQtyMap(supabase, storeId);

  const insertRows = toOrder.map((p) => ({
    store_id: storeId,
    product_id: p.id,
    quantity: weekSales.get(p.id) || 1,
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

// 이 매장의 상품별 최근 7일 판매 수량 합계.
export async function getWeekSoldQtyMap(
  supabase: SupabaseClient,
  storeId: string
): Promise<Map<string, number>> {
  const from = new Date();
  from.setDate(from.getDate() - 7);

  const items = await fetchAllPages<{ product_id: string; quantity: number }>((f, t) =>
    supabase
      .from("sale_items")
      .select("product_id, quantity, sales!inner(created_at)")
      .eq("store_id", storeId)
      .gte("sales.created_at", from.toISOString())
      .range(f, t)
      .then((res) => ({
        data: res.data as unknown as { product_id: string; quantity: number }[] | null,
        error: res.error,
      }))
  );

  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
  }
  return map;
}
