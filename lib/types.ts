export type UserRole = "admin" | "staff";

export const PAYMENT_METHODS = [
  { value: "cash", label: "현금" },
  { value: "card", label: "카드" },
  { value: "easy_pay", label: "간편결제" },
  { value: "bank_transfer", label: "계좌이체" },
  { value: "points", label: "포인트" },
  { value: "coupon", label: "쿠폰" },
] as const;

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export type Store = {
  id: string;
  name: string;
  address: string | null;
  cash_alert_threshold: number | null;
  default_margin_percent: number;
  default_delivery_fee: number;
  free_shipping_threshold: number | null;
  created_at: string;
};

export type CashTransaction = {
  id: string;
  store_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  memo: string | null;
  denominations: Record<string, number> | null;
  created_by: string | null;
  created_at: string;
};

export type KioskStatus = "online" | "offline" | "maintenance";

export const KIOSK_STATUS_LABELS: Record<KioskStatus, string> = {
  online: "정상",
  offline: "오프라인",
  maintenance: "점검중",
};

export type Kiosk = {
  id: string;
  store_id: string;
  name: string;
  status: KioskStatus;
  memo: string | null;
  // 실제 키오스크 화면 프로그램이 붙기 전까지 미리 설정해두는 화면 문구.
  notice_message: string | null;
  banner_message: string | null;
  updated_at: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type Camera = {
  id: string;
  store_id: string;
  name: string;
  stream_url: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  store_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  store_id: string;
  barcode: string;
  name: string;
  category_id: string | null;
  is_tax_exempt: boolean;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  image_url: string | null;
  auto_order_enabled: boolean;
  reorder_qty: number;
  coupang_product_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderChannel = "hq" | "coupang";
export type PurchaseOrderSource = "auto" | "manual";
// 실제 쇼핑몰 유통 흐름과 같은 4단계 + 취소. 발주완료 단계에서만 취소할 수 있다.
// 본부 발주가 배송완료로 넘어가면 재고에 자동으로 반영된다(쿠팡은 바코드 연동이
// 없어 상태만 바뀌고 재고는 입고 등록에서 직접 등록해야 함).
export type PurchaseOrderStatus = "confirmed" | "preparing" | "shipping" | "delivered" | "cancelled";

export const PURCHASE_ORDER_CHANNEL_LABELS: Record<PurchaseOrderChannel, string> = {
  hq: "본부",
  coupang: "쿠팡",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  confirmed: "발주완료",
  preparing: "상품준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소",
};

// 진행 순서(취소 제외) — 다음 단계 계산, 진행률 표시 등에 쓴다.
export const PURCHASE_ORDER_STATUS_FLOW: PurchaseOrderStatus[] = [
  "confirmed",
  "preparing",
  "shipping",
  "delivered",
];

export type PurchaseOrder = {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  channel: PurchaseOrderChannel;
  source: PurchaseOrderSource;
  status: PurchaseOrderStatus;
  coupang_link: string | null;
  created_by: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Promotion = {
  id: string;
  store_id: string;
  product_id: string;
  discount_type: "amount" | "percent";
  discount_value: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_type: "amount" | "percent";
  discount_value: number;
  active: boolean;
  created_at: string;
};

export type StockIn = {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockAdjustmentReason = "disposal" | "return" | "loss" | "other";

export const STOCK_ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  disposal: "폐기",
  return: "반품",
  loss: "분실/도난",
  other: "기타",
};

export type StockAdjustment = {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  reason: StockAdjustmentReason;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProductExpiry = {
  id: string;
  store_id: string;
  product_id: string;
  expiry_date: string;
  quantity: number;
  created_by: string | null;
  created_at: string;
};

export type SaleStatus = "completed" | "cancelled";

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  completed: "정상",
  cancelled: "취소",
};

// 키오스크에서 구매자가 "배송으로 받기"를 선택한 주문의 처리 단계.
// 배송요청 단계에서만 취소할 수 있다(발주/발주상태 흐름과 동일한 규칙).
export type DeliveryStatus =
  | "requested"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  requested: "배송요청",
  preparing: "상품준비중",
  out_for_delivery: "배송중",
  delivered: "배송완료",
  cancelled: "취소",
};

export const DELIVERY_STATUS_FLOW: DeliveryStatus[] = [
  "requested",
  "preparing",
  "out_for_delivery",
  "delivered",
];

export type Sale = {
  id: string;
  store_id: string;
  total_amount: number;
  payment_method: string;
  discount_amount: number;
  status: SaleStatus;
  customer_id: string | null;
  created_by: string | null;
  created_at: string;
  // 키오스크(PG단말기) 연동 전까지는 모두 null — 연동되면 그쪽에서 채워 넣는다.
  kiosk_label: string | null;
  order_number: string | null;
  approval_number: string | null;
  payment_detail: string | null;
  // 배송주문건 관련 필드. is_delivery가 false면 나머지는 의미 없다.
  is_delivery: boolean;
  delivery_status: DeliveryStatus | null;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_memo: string | null;
  delivery_fee: number;
};

export type Customer = {
  id: string;
  store_id: string;
  phone: string;
  name: string | null;
  first_seen_at: string;
  created_at: string;
};

export type CampaignType = "routine" | "clearance" | "deadtime" | "winback" | "welcome" | "manual";

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  routine: "루틴 리마인드",
  clearance: "마감 할인",
  deadtime: "심야/한산 시간대",
  winback: "재방문 유도",
  welcome: "첫 방문 환영",
  manual: "수동 발급",
};

export type CustomerCoupon = {
  id: string;
  store_id: string;
  customer_id: string;
  title: string;
  discount_type: "amount" | "percent";
  discount_value: number;
  campaign_type: CampaignType;
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_sale_id: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type CartItem = {
  product: Product;
  quantity: number;
};
