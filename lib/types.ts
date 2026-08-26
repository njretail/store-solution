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
  created_at: string;
};

export type CashTransaction = {
  id: string;
  store_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  memo: string | null;
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
  updated_at: string;
  created_at: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  store_id: string | null;
  name: string | null;
  email: string | null;
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
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
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

export type ProductExpiry = {
  id: string;
  store_id: string;
  product_id: string;
  expiry_date: string;
  quantity: number;
  created_by: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  store_id: string;
  total_amount: number;
  payment_method: string;
  discount_amount: number;
  created_by: string | null;
  created_at: string;
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
