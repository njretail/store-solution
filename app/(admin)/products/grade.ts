export type Grade = "A" | "B" | "C";

export const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-zinc-100 text-zinc-600",
};

// 최근 30일 매출금액 기준 ABC 파레토 등급(A: 상위 80%, B: 다음 15%, C: 나머지).
// 발주 우선순위 판단용 — 상품 조회, 재고소진상품 화면에서 공통으로 쓴다.
export function buildGradeMap(ranked: Array<{ product_id: string; revenue: number }>) {
  const sorted = [...ranked].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((sum, r) => sum + r.revenue, 0);
  const gradeMap = new Map<string, Grade>();
  let cumulative = 0;
  for (const r of sorted) {
    cumulative += r.revenue;
    const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
    gradeMap.set(r.product_id, pct <= 80 ? "A" : pct <= 95 ? "B" : "C");
  }
  return gradeMap;
}
