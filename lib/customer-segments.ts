export type Tag = "morning_coffee" | "night_owl" | "snack_lover" | "vip" | "winback_risk" | "new";

export const TAG_LABELS: Record<Tag, string> = {
  morning_coffee: "☕ 모닝커피족",
  night_owl: "🌙 야식파",
  snack_lover: "🍿 주류/스낵파",
  vip: "⭐ 단골",
  winback_risk: "⚠️ 이탈위험",
  new: "🆕 신규",
};

export type SaleRecord = { customerId: string; saleId: string; createdAt: string; totalAmount: number };
export type ItemRecord = { customerId: string; saleId: string; categoryName: string | null; productId: string; productName: string; quantity: number };

export type CustomerSegment = {
  customerId: string;
  visitCount: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  daysSinceLastVisit: number;
  // 이 고객 본인의 평균 방문 간격(일). 방문이 1회뿐이면 계산 불가(null).
  avgIntervalDays: number | null;
  // daysSinceLastVisit가 이 고객 평소 간격보다 훨씬 길어진 상태 — "이 고객 기준으로 뜸해짐".
  isOverdue: boolean;
  topProductId: string | null;
  topProductName: string | null;
  preferredTimeLabel: string;
  tags: Tag[];
};

// created_at은 UTC ISO 문자열로 오므로, 서버(Vercel 등)가 UTC로 돌아도 항상 한국시간
// 기준으로 판단하도록 직접 +9시간 보정한다(new Date().getHours()는 서버 타임존에 좌우돼서 위험함).
function kstHour(iso: string): number {
  const utcHour = new Date(iso).getUTCHours();
  return (utcHour + 9) % 24;
}

const MORNING_HOURS = new Set([6, 7, 8, 9]);
const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5]);

const VIP_VISIT_THRESHOLD = 5;
const WINBACK_MIN_VISITS = 2;
const WINBACK_DAYS = 14;
const NEW_CUSTOMER_DAYS = 7;

// 방문 시간대를 사람이 읽기 좋은 구간으로 분류한다.
type TimeBucket = "새벽/심야" | "아침" | "낮" | "오후" | "저녁";
function timeBucket(hour: number): TimeBucket {
  if (hour >= 6 && hour < 11) return "아침";
  if (hour >= 11 && hour < 14) return "낮";
  if (hour >= 14 && hour < 18) return "오후";
  if (hour >= 18 && hour < 22) return "저녁";
  return "새벽/심야";
}

export function computeCustomerSegments(
  sales: SaleRecord[],
  items: ItemRecord[],
  now: Date = new Date()
): Map<string, CustomerSegment> {
  const byCustomer = new Map<string, SaleRecord[]>();
  for (const s of sales) {
    const list = byCustomer.get(s.customerId) ?? [];
    list.push(s);
    byCustomer.set(s.customerId, list);
  }

  const categoriesByCustomer = new Map<string, string[]>();
  const productCountByCustomer = new Map<string, Map<string, { name: string; qty: number }>>();
  for (const it of items) {
    if (it.categoryName) {
      const list = categoriesByCustomer.get(it.customerId) ?? [];
      list.push(it.categoryName);
      categoriesByCustomer.set(it.customerId, list);
    }
    const productMap = productCountByCustomer.get(it.customerId) ?? new Map();
    const entry = productMap.get(it.productId) ?? { name: it.productName, qty: 0 };
    entry.qty += it.quantity;
    productMap.set(it.productId, entry);
    productCountByCustomer.set(it.customerId, productMap);
  }

  const result = new Map<string, CustomerSegment>();

  for (const [customerId, customerSales] of byCustomer.entries()) {
    const sorted = [...customerSales].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const visitCount = sorted.length;
    const totalSpent = sorted.reduce((sum, s) => sum + s.totalAmount, 0);
    const firstVisit = sorted[0].createdAt;
    const lastVisit = sorted[sorted.length - 1].createdAt;
    const daysSinceLastVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));

    const avgIntervalDays =
      visitCount >= 2
        ? (new Date(lastVisit).getTime() - new Date(firstVisit).getTime()) / (1000 * 60 * 60 * 24) / (visitCount - 1)
        : null;
    const overdueThreshold = avgIntervalDays !== null ? Math.max(avgIntervalDays * 1.5, 3) : null;
    const isOverdue = overdueThreshold !== null && daysSinceLastVisit >= overdueThreshold;

    let morningCount = 0;
    let nightCount = 0;
    const bucketCounts = new Map<TimeBucket, number>();
    for (const s of sorted) {
      const h = kstHour(s.createdAt);
      if (MORNING_HOURS.has(h)) morningCount += 1;
      if (NIGHT_HOURS.has(h)) nightCount += 1;
      const bucket = timeBucket(h);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    }
    const preferredBucket = [...bucketCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "낮";
    const preferredTimeLabel = `주로 ${preferredBucket}에 방문`;

    const productMap = productCountByCustomer.get(customerId);
    let topProductId: string | null = null;
    let topProductName: string | null = null;
    if (productMap && productMap.size > 0) {
      const [id, entry] = [...productMap.entries()].sort((a, b) => b[1].qty - a[1].qty)[0];
      topProductId = id;
      topProductName = entry.name;
    }

    const categories = categoriesByCustomer.get(customerId) ?? [];
    const hasCategory = (keyword: string) => categories.some((c) => c.includes(keyword));

    const tags: Tag[] = [];
    if (daysSinceLastVisit <= NEW_CUSTOMER_DAYS && visitCount === 1) tags.push("new");
    if (visitCount >= VIP_VISIT_THRESHOLD) tags.push("vip");
    if (visitCount >= WINBACK_MIN_VISITS && daysSinceLastVisit > WINBACK_DAYS) tags.push("winback_risk");
    if (morningCount / visitCount >= 0.5 && (hasCategory("음료") || hasCategory("커피"))) {
      tags.push("morning_coffee");
    }
    if (nightCount / visitCount >= 0.5) tags.push("night_owl");
    if (hasCategory("주류") || hasCategory("과자") || hasCategory("스낵")) tags.push("snack_lover");

    result.set(customerId, {
      customerId,
      visitCount,
      totalSpent,
      firstVisit,
      lastVisit,
      daysSinceLastVisit,
      avgIntervalDays,
      isOverdue,
      topProductId,
      topProductName,
      preferredTimeLabel,
      tags,
    });
  }

  return result;
}
