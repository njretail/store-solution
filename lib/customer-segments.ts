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
export type ItemRecord = { customerId: string; categoryName: string | null };

export type CustomerSegment = {
  customerId: string;
  visitCount: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  daysSinceLastVisit: number;
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
  for (const it of items) {
    if (!it.categoryName) continue;
    const list = categoriesByCustomer.get(it.customerId) ?? [];
    list.push(it.categoryName);
    categoriesByCustomer.set(it.customerId, list);
  }

  const result = new Map<string, CustomerSegment>();

  for (const [customerId, customerSales] of byCustomer.entries()) {
    const sorted = [...customerSales].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const visitCount = sorted.length;
    const totalSpent = sorted.reduce((sum, s) => sum + s.totalAmount, 0);
    const firstVisit = sorted[0].createdAt;
    const lastVisit = sorted[sorted.length - 1].createdAt;
    const daysSinceLastVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));

    let morningCount = 0;
    let nightCount = 0;
    for (const s of sorted) {
      const h = kstHour(s.createdAt);
      if (MORNING_HOURS.has(h)) morningCount += 1;
      if (NIGHT_HOURS.has(h)) nightCount += 1;
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
      tags,
    });
  }

  return result;
}
