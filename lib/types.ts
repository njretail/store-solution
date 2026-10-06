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
  // 거스름돈용 소액권(1,000원 이하)이 부족해지는 걸 따로 감지하는 기준.
  change_alert_threshold: number | null;
  default_margin_percent: number;
  default_delivery_fee: number;
  free_shipping_threshold: number | null;
  store_type: "direct" | "franchise";
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
  // 원격 명령("refresh"/"restart_program"/"restart_device"/"shutdown_device") + 보낸
  // 시각. "refresh"는 키오스크 화면(/kiosk/[id])이 직접 폴링해서 처리하고, 나머지는
  // 브라우저가 할 수 없는 OS 영역이라 PC에 설치된 kiosk-agent(PowerShell)가 폴링해서
  // 실제로 실행한다 — 에이전트가 없으면 효과 없음.
  remote_command: string | null;
  remote_command_at: string | null;
  // "HH:MM:SS" 형식(time 컬럼) — kiosk-agent가 매일 이 시각에 기기를 재부팅한다.
  daily_reboot_time: string | null;
  updated_at: string;
  created_at: string;
};

// kiosk_id가 null이면 그 매장의 모든 키오스크에 공통으로 노출된다.
export type KioskAd = {
  id: string;
  store_id: string;
  kiosk_id: string | null;
  image_url: string;
  sort_order: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

// audio_url이 있으면 그 파일을 재생하고, 없으면 브라우저 TTS(speechSynthesis)로 message를 읽는다.
export type KioskAnnouncement = {
  id: string;
  store_id: string;
  kiosk_id: string | null;
  message: string;
  audio_url: string | null;
  sort_order: number;
  active: boolean;
  created_by: string | null;
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
  // 'hq' = 본사 상품 일괄 등록으로 생성/갱신됨(통제수준 ①본사고정이 적용될 수 있음).
  // 'store' = 점포가 직접 만든 상품(상품 추가, 대량매입 신규등록) — 본사가 가격을
  // 정해준 적이 없어 정책과 무관하게 항상 점포가 수정할 수 있다.
  origin: "hq" | "store";
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
  // 물리적 바코드가 없는 상품(생물·즉석조리 등)을 키오스크 화면의 "바코드판"에
  // 띄워서, 손님이 그 화면의 바코드를 스캐너에 대고 결제할 수 있게 한다.
  show_on_kiosk_board: boolean;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderChannel = "hq" | "coupang";
export type PurchaseOrderSource = "auto" | "manual";
// 요청 -> 검토 -> 발주완료 -> 상품준비중 -> 배송중 -> 배송완료 + 반려/취소.
// 검토대기 단계에서만 승인(발주완료)/반려할 수 있고, 발주완료 단계에서만 취소할 수 있다.
// 본부 발주가 배송완료로 넘어갈 때는 입고 검수(실제 수령 수량)를 거쳐 그 수량만
// 재고에 반영된다(쿠팡은 바코드 연동이 없어 상태만 바뀌고 재고는 입고 등록에서
// 직접 등록해야 함).
export type PurchaseOrderStatus =
  | "requested"
  | "confirmed"
  | "preparing"
  | "shipping"
  | "delivered"
  | "rejected"
  | "cancelled";

export const PURCHASE_ORDER_CHANNEL_LABELS: Record<PurchaseOrderChannel, string> = {
  hq: "본부",
  coupang: "쿠팡",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  requested: "검토대기",
  confirmed: "발주완료",
  preparing: "상품준비중",
  shipping: "배송중",
  delivered: "배송완료",
  rejected: "반려됨",
  cancelled: "취소",
};

// 진행 순서(반려/취소 제외) — 다음 단계 계산, 진행률 표시 등에 쓴다.
export const PURCHASE_ORDER_STATUS_FLOW: PurchaseOrderStatus[] = [
  "requested",
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
  // 검토 단계에서 수량을 조정했을 때만 채워진다(null이면 요청 수량 그대로 승인됨).
  approved_quantity: number | null;
  // 입고 검수에서 확인한 실제 수령 수량(본부 채널, 배송완료 이후에만 채워짐).
  received_quantity: number | null;
  review_memo: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  receiving_memo: string | null;
  received_by: string | null;
  received_at: string | null;
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
  // 결제 중 식별을 위해 그냥 받은 번호와, 실제로 "마케팅 소식 받기"에 동의한 번호를
  // 구분한다 — 전화번호를 받았다고 전부 마케팅에 써도 되는 게 아니기 때문.
  marketing_opt_in: boolean;
  marketing_consent_at: string | null;
};

export type CampaignType =
  | "routine"
  | "clearance"
  | "deadtime"
  | "winback"
  | "welcome"
  | "manual"
  | "marketing_optin";

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  routine: "루틴 리마인드",
  clearance: "마감 할인",
  deadtime: "심야/한산 시간대",
  winback: "재방문 유도",
  welcome: "첫 방문 환영",
  manual: "수동 발급",
  marketing_optin: "마케팅 수신동의",
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
  // 판매 당시 products.cost_price 스냅샷. 이후 공급가가 바뀌어도 이미 끝난
  // 판매의 마진은 이 값으로 고정된다 — 0028_sale_item_cost.sql 이전 판매 건은
  // 그 시점의 현재 원가로 근사치 채움(정확한 과거 원가 아님).
  unit_cost: number;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type UrgentAlertType = "theft" | "fridge_power" | "other";

export const URGENT_ALERT_TYPE_LABELS: Record<UrgentAlertType, string> = {
  theft: "도난·보안",
  fridge_power: "냉장고 전원",
  other: "기타 긴급",
};

// 실제 센서/보안 장비 연동 전까지는 관리자가 "테스트 알림 보내기"로만 만들어진다
// (/api/alerts/urgent 웹훅이 연동 지점으로 마련돼 있지만 실제 호출하는 장비는 아직 없음).
export type UrgentAlert = {
  id: string;
  store_id: string;
  type: UrgentAlertType;
  message: string;
  source: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ChangeTransferStatus = "pending" | "paid" | "cancelled";

export const CHANGE_TRANSFER_STATUS_LABELS: Record<ChangeTransferStatus, string> = {
  pending: "지급대기",
  paid: "지급완료",
  cancelled: "지급취소",
};

// 거스름돈이 모자라 고객에게 현금으로 다 돌려주지 못했을 때, 고객 계좌로 나중에
// 송금하기 위해 등록하는 요청. sale_id는 특정 판매 건에 연결하고 싶을 때만 쓰고
// (지금은 연결 화면이 없어 항상 null), 직원이 이 화면에서 직접 등록하는 게 기본 경로.
export type ChangeTransferRequest = {
  id: string;
  store_id: string;
  sale_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  bank_name: string;
  account_number: string;
  account_holder: string;
  amount: number;
  status: ChangeTransferStatus;
  memo: string | null;
  requested_by: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
};
