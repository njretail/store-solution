import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all-pages";
import { computeCustomerSegments } from "./customer-segments";

const WINBACK_DISCOUNT_PERCENT = 15;
const WINBACK_COUPON_VALID_DAYS = 7;

export type WinbackIssuedCoupon = { customerId: string; phone: string; title: string };

// 이 매장의 고객들을 훑어서 "본인 평소 방문 간격보다 뜸해진" 고객에게, 그 고객이 가장 즐겨
// 사는 상품 기준으로 15% 할인 쿠폰을 자동 발급한다. 이미 사용 전인 winback 쿠폰을 갖고 있으면
// 중복 발급하지 않는다. Vercel Cron(app/api/cron/winback)과 관리자 수동 실행 버튼이 함께 호출한다.
export async function runWinbackScan(
  supabase: SupabaseClient,
  storeId: string
): Promise<WinbackIssuedCoupon[]> {
  const [customers, sales] = await Promise.all([
    fetchAllPages<{ id: string; phone: string }>((from, to) =>
      supabase.from("customers").select("id, phone").eq("store_id", storeId).range(from, to)
    ),
    fetchAllPages<{ id: string; customer_id: string; created_at: string; total_amount: number }>(
      (from, to) =>
        supabase
          .from("sales")
          .select("id, customer_id, created_at, total_amount")
          .eq("store_id", storeId)
          .not("customer_id", "is", null)
          .range(from, to)
    ),
  ]);

  type SaleItemRow = {
    sale_id: string;
    product_id: string;
    quantity: number;
    products: { name: string; categories: { name: string } | null } | null;
  };

  const saleIds = sales.map((s) => s.id);
  const itemsData =
    saleIds.length > 0
      ? await fetchAllPages<SaleItemRow>((from, to) =>
          supabase
            .from("sale_items")
            .select("sale_id, product_id, quantity, products(name, categories(name))")
            .in("sale_id", saleIds)
            .range(from, to)
            .then((res) => ({ data: res.data as unknown as SaleItemRow[] | null, error: res.error }))
        )
      : [];

  const saleToCustomer = new Map(sales.map((s) => [s.id, s.customer_id]));
  const items = itemsData
    .map((it) => ({
      customerId: saleToCustomer.get(it.sale_id) ?? "",
      saleId: it.sale_id,
      categoryName: it.products?.categories?.name ?? null,
      productId: it.product_id,
      productName: it.products?.name ?? "상품",
      quantity: it.quantity,
    }))
    .filter((it) => it.customerId);

  const segments = computeCustomerSegments(
    sales.map((s) => ({
      customerId: s.customer_id,
      saleId: s.id,
      createdAt: s.created_at,
      totalAmount: s.total_amount,
    })),
    items
  );

  const { data: activeWinback } = await supabase
    .from("customer_coupons")
    .select("customer_id")
    .eq("store_id", storeId)
    .eq("campaign_type", "winback")
    .is("redeemed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const hasActiveWinback = new Set((activeWinback ?? []).map((c) => c.customer_id));

  const issued: WinbackIssuedCoupon[] = [];

  for (const customer of customers) {
    const seg = segments.get(customer.id);
    if (!seg || !seg.isOverdue || hasActiveWinback.has(customer.id) || !seg.topProductName) continue;

    const title = `${seg.topProductName} ${WINBACK_DISCOUNT_PERCENT}% 할인 쿠폰`;
    const { error } = await supabase.from("customer_coupons").insert({
      store_id: storeId,
      customer_id: customer.id,
      title,
      discount_type: "percent",
      discount_value: WINBACK_DISCOUNT_PERCENT,
      campaign_type: "winback",
      expires_at: new Date(Date.now() + WINBACK_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (!error) {
      issued.push({ customerId: customer.id, phone: customer.phone, title });
    }
  }

  return issued;
}
