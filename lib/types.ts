export type UserRole = "admin" | "staff";

export type Store = {
  id: string;
  name: string;
  address: string | null;
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
  category: string | null;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
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
