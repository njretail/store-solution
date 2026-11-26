// 포인트 적립 — DB 구조·규칙은 supabase/migrations/0042_points.sql 참고.
// 잔액·사용 가능 여부의 최종 판단은 항상 DB 함수(record_sale, point_summary)가 한다. 여기 계산은 화면 안내용.

export type PointPolicy = {
  enabled: boolean;
  earn_rate: number; // 결제금액의 %
  min_purchase_for_earn: number; // 이 금액 이상 결제해야 적립
  available_after_days: number; // 0 = 바로 사용
  min_balance_to_use: number; // 이만큼 모여야 사용
  use_unit: number; // 사용 단위
  max_use_rate: number; // 결제금액의 최대 %까지 사용
  expire_months: number; // 0 = 소멸 없음
  require_pin: boolean;
};

export const DEFAULT_POINT_POLICY: PointPolicy = {
  enabled: false,
  earn_rate: 1,
  min_purchase_for_earn: 0,
  available_after_days: 0,
  min_balance_to_use: 1000,
  use_unit: 100,
  max_use_rate: 100,
  expire_months: 12,
  require_pin: true,
};

export type PointSummary = {
  enabled: boolean;
  customer_exists: boolean;
  balance: number;
  pending: number;
  expiring_30d: number;
  has_pin: boolean;
  locked: boolean;
  can_use: boolean;
  policy: Omit<PointPolicy, "enabled">;
};

export type PointLedgerRow = {
  id: string;
  customer_id: string;
  sale_id: string | null;
  kind: "earn" | "use" | "cancel_earn" | "cancel_use" | "adjust";
  amount: number;
  remaining: number;
  available_at: string;
  expires_at: string | null;
  memo: string | null;
  created_at: string;
};

export const POINT_KIND_LABELS: Record<PointLedgerRow["kind"], string> = {
  earn: "적립",
  use: "사용",
  cancel_earn: "적립 취소",
  cancel_use: "사용 취소(반환)",
  adjust: "직접 조정",
};

/** 정책을 한 줄 안내문으로 (키오스크·판매 화면·관리 화면 공통) */
export function describePolicy(p: Omit<PointPolicy, "enabled">): string[] {
  return [
    `결제금액의 ${Number(p.earn_rate)}% 적립${p.min_purchase_for_earn > 0 ? ` (${p.min_purchase_for_earn.toLocaleString()}원 이상 결제 시)` : ""}`,
    p.available_after_days > 0 ? `적립 ${p.available_after_days}일 뒤부터 사용` : "적립 즉시 사용 가능",
    `${p.min_balance_to_use.toLocaleString()}점 이상 모이면 ${p.use_unit.toLocaleString()}점 단위로 사용${p.max_use_rate < 100 ? ` (결제금액의 ${p.max_use_rate}%까지)` : ""}`,
    p.expire_months > 0 ? `적립일로부터 ${p.expire_months}개월 뒤 소멸` : "소멸 없음",
    p.require_pin ? "사용할 때 포인트 비밀번호(4자리) 확인" : "사용할 때 번호만 확인",
  ];
}

/** 이번 결제에서 쓸 수 있는 최대 포인트 (화면 안내용, 서버가 다시 검사) */
export function maxUsablePoints(summary: PointSummary, payAmount: number): number {
  if (!summary.can_use || payAmount <= 0) return 0;
  const p = summary.policy;
  const cap = Math.floor((payAmount * p.max_use_rate) / 100);
  const raw = Math.min(summary.balance, cap);
  return Math.floor(raw / p.use_unit) * p.use_unit;
}

export function earnPreview(policy: Omit<PointPolicy, "enabled">, paid: number): number {
  if (paid <= 0 || paid < policy.min_purchase_for_earn) return 0;
  return Math.floor((paid * Number(policy.earn_rate)) / 100);
}
