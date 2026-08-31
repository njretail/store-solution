import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { computeCustomerSegments, TAG_LABELS, type Tag } from "@/lib/customer-segments";
import WinbackScanButton from "./WinbackScanButton";

const TAG_FILTERS: Array<{ value: Tag | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "winback_risk", label: TAG_LABELS.winback_risk },
  { value: "vip", label: TAG_LABELS.vip },
  { value: "morning_coffee", label: TAG_LABELS.morning_coffee },
  { value: "night_owl", label: TAG_LABELS.night_owl },
  { value: "snack_lover", label: TAG_LABELS.snack_lover },
  { value: "new", label: TAG_LABELS.new },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const activeTag = (params.tag ?? "all") as Tag | "all";
  const query = (params.q ?? "").trim();

  const [customers, sales] = await Promise.all([
    fetchAllPages<{ id: string; phone: string; name: string | null }>((from, to) =>
      supabase.from("customers").select("id, phone, name").eq("store_id", store.id).range(from, to)
    ),
    fetchAllPages<{ id: string; customer_id: string; created_at: string; total_amount: number }>(
      (from, to) =>
        supabase
          .from("sales")
          .select("id, customer_id, created_at, total_amount")
          .eq("store_id", store.id)
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

  const rows = customers
    .map((c) => ({ customer: c, segment: segments.get(c.id) }))
    .filter((r) => r.segment)
    .filter((r) => activeTag === "all" || r.segment!.tags.includes(activeTag as Tag))
    .filter((r) => !query || r.customer.phone.includes(query) || (r.customer.name ?? "").includes(query))
    .sort((a, b) => b.segment!.totalSpent - a.segment!.totalSpent);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">고객관리</h1>
          <p className="text-sm text-zinc-500">{store.name}</p>
        </div>
        <WinbackScanButton />
      </div>

      <p className="text-sm text-zinc-500">
        결제 시 전화번호가 입력된 고객만 여기 나타납니다. 태그는 최근 구매 이력을 기준으로
        자동 계산됩니다(이탈위험: 2회 이상 방문했다가 14일 이상 재방문 없음 / 단골: 5회 이상
        방문 / 모닝커피족·야식파: 방문 시간대 절반 이상이 해당 시간대 / 주류·스낵파: 해당
        카테고리 구매 이력 있음). 주력상품·방문시간대는 이 고객의 실제 구매 패턴에서 계산됩니다.
        &ldquo;(뜸해짐)&rdquo;은 이 고객 본인의 평소 방문 간격보다 훨씬 오래 안 온 상태를
        뜻하며, 매일 자동으로(또는 위 버튼으로 지금 바로) 주력상품 15% 할인 쿠폰이 발급됩니다.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TAG_FILTERS.map((t) => (
            <Link
              key={t.value}
              href={`/customers?tag=${t.value}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                activeTag === t.value
                  ? "border-[#C8075F] bg-[#C8075F] text-white"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <form className="flex items-center gap-2">
          <input type="hidden" name="tag" value={activeTag} />
          <input
            name="q"
            defaultValue={query}
            placeholder="전화번호로 조회"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
            조회
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">전화번호</th>
              <th className="px-4 py-3">태그</th>
              <th className="px-4 py-3">주력상품</th>
              <th className="px-4 py-3">방문시간대</th>
              <th className="px-4 py-3">방문횟수</th>
              <th className="px-4 py-3">누적구매액</th>
              <th className="px-4 py-3">최근방문</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ customer, segment }) => (
              <tr key={customer.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{customer.name ? `${customer.name} (${customer.phone})` : customer.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {segment!.tags.map((t) => (
                      <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {TAG_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-700">{segment!.topProductName ?? "-"}</td>
                <td className="px-4 py-3 text-zinc-500">{segment!.preferredTimeLabel}</td>
                <td className="px-4 py-3">{segment!.visitCount}회</td>
                <td className="px-4 py-3">{segment!.totalSpent.toLocaleString()}원</td>
                <td className="px-4 py-3 text-zinc-500">
                  {segment!.daysSinceLastVisit === 0 ? "오늘" : `${segment!.daysSinceLastVisit}일 전`}
                  {segment!.isOverdue && <span className="ml-1 text-amber-600">(뜸해짐)</span>}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${customer.id}`} className="text-sm text-[#C8075F] underline">
                    상세/쿠폰
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                  해당하는 고객이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
