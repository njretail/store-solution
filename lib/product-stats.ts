import { gradeFromCumulativePercent, type Grade } from "@/lib/grade";

// 서버(Vercel)는 UTC로 돌아가므로, KST 날짜/시간대별 집계를 하려면 반드시 +9시간
// 보정한 뒤 UTC 필드를 읽어야 한다(다른 곳의 KST 보정 로직과 동일한 이유).
function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
}

export function kstDateKey(iso: string): string {
  return toKst(iso).toISOString().slice(0, 10);
}

export function kstHour(iso: string): number {
  return toKst(iso).getUTCHours();
}

export type SaleItemRow = {
  product_id: string;
  quantity: number;
  subtotal: number;
  created_at: string;
};

export type ProductInfo = {
  id: string;
  name: string;
  category_id: string | null;
  stock_qty: number;
};

export type CategoryInfo = { id: string; name: string };

export type ProductRankRow = {
  product_id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  sharePercent: number;
  cumulativePercent: number;
  grade: Grade;
};

export function buildProductRanking(
  items: SaleItemRow[],
  products: Map<string, ProductInfo>,
  categories: Map<string, string>
): ProductRankRow[] {
  const byProduct = new Map<string, { quantity: number; revenue: number }>();
  for (const item of items) {
    const agg = byProduct.get(item.product_id) ?? { quantity: 0, revenue: 0 };
    agg.quantity += item.quantity;
    agg.revenue += item.subtotal;
    byProduct.set(item.product_id, agg);
  }

  const rows = Array.from(byProduct.entries()).map(([productId, agg]) => {
    const product = products.get(productId);
    const categoryName = product?.category_id ? categories.get(product.category_id) : null;
    return {
      product_id: productId,
      name: product?.name ?? "(삭제된 상품)",
      category: categoryName ?? "미분류",
      quantity: agg.quantity,
      revenue: agg.revenue,
    };
  });
  rows.sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.revenue;
    const cumulativePercent = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
    return {
      ...r,
      sharePercent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
      cumulativePercent,
      grade: gradeFromCumulativePercent(cumulativePercent),
    };
  });
}

export type CategoryShare = { category: string; revenue: number; percent: number };

export function buildCategoryBreakdown(ranking: ProductRankRow[]): CategoryShare[] {
  const byCategory = new Map<string, number>();
  for (const r of ranking) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.revenue);
  }
  const total = ranking.reduce((sum, r) => sum + r.revenue, 0);
  return Array.from(byCategory.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percent: total > 0 ? (revenue / total) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type DailyRevenue = { date: string; revenue: number };

// fromIso~toIso 범위의 날짜를 전부 채워서 반환한다(매출 없는 날도 0으로 표시되어야
// 막대 그래프에서 "그 날만 빠짐"이 아니라 "0원"으로 정확히 보임).
export function buildDailyTrend(
  items: SaleItemRow[],
  fromIso: string,
  toIso: string
): DailyRevenue[] {
  const byDate = new Map<string, number>();
  for (const item of items) {
    const key = kstDateKey(item.created_at);
    byDate.set(key, (byDate.get(key) ?? 0) + item.subtotal);
  }

  const days: DailyRevenue[] = [];
  const cursor = toKst(fromIso);
  const end = toKst(toIso);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, revenue: byDate.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export type HourlyRevenue = { hour: number; revenue: number };

export function buildHourlyDistribution(items: SaleItemRow[]): HourlyRevenue[] {
  const byHour = new Array(24).fill(0) as number[];
  for (const item of items) {
    byHour[kstHour(item.created_at)] += item.subtotal;
  }
  return byHour.map((revenue, hour) => ({ hour, revenue }));
}

export type DeadStockRow = { id: string; name: string; category: string; stock_qty: number };

// 기간 중 한 건도 안 팔렸는데 재고는 있는 상품 — 매출에 기여하지 못하고 있는 상품을
// 잡아내기 위함(진열 위치 변경/할인/발주 중단 판단용).
export function findDeadStock(
  products: ProductInfo[],
  categories: Map<string, string>,
  soldProductIds: Set<string>
): DeadStockRow[] {
  return products
    .filter((p) => p.stock_qty > 0 && !soldProductIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category_id ? categories.get(p.category_id) ?? "미분류" : "미분류",
      stock_qty: p.stock_qty,
    }))
    .sort((a, b) => b.stock_qty - a.stock_qty);
}
