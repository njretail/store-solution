import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { computeCustomerSegments, TAG_LABELS } from "@/lib/customer-segments";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/types";
import IssueCouponForm from "../IssueCouponForm";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: customer }, { data: salesData }, { data: couponsData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sales")
      .select("id, total_amount, created_at, status")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_coupons")
      .select("*")
      .eq("customer_id", id)
      .order("issued_at", { ascending: false }),
  ]);

  if (!customer) return null;

  const sales = salesData ?? [];
  const saleIds = sales.map((s) => s.id);
  const { data: itemsData } =
    saleIds.length > 0
      ? await supabase.from("sale_items").select("sale_id, products(categories(name))").in("sale_id", saleIds)
      : { data: [] };

  const items = (
    (itemsData ?? []) as unknown as Array<{ products: { categories: { name: string } | null } | null }>
  ).map((it) => ({
    customerId: id,
    categoryName: it.products?.categories?.name ?? null,
  }));

  const segments = computeCustomerSegments(
    sales.map((s) => ({ customerId: id, saleId: s.id, createdAt: s.created_at, totalAmount: s.total_amount })),
    items
  );
  const segment = segments.get(id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/customers" className="text-sm text-[#C8075F] underline">
          ← 고객관리로
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          {customer.name ? `${customer.name} (${customer.phone})` : customer.phone}
        </h1>
      </div>

      {segment && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <div className="flex flex-wrap gap-1">
            {segment.tags.length === 0 ? (
              <span className="text-sm text-zinc-400">태그 없음</span>
            ) : (
              segment.tags.map((t) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {TAG_LABELS[t]}
                </span>
              ))
            )}
          </div>
          <div className="ml-auto flex gap-6 text-sm text-zinc-600">
            <span>방문 {segment.visitCount}회</span>
            <span>누적 {segment.totalSpent.toLocaleString()}원</span>
            <span>
              최근방문 {segment.daysSinceLastVisit === 0 ? "오늘" : `${segment.daysSinceLastVisit}일 전`}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700">구매 이력</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">일시</th>
                  <th className="px-3 py-2">금액</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-zinc-500">
                      {new Date(s.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">{s.total_amount.toLocaleString()}원</td>
                    <td className="px-3 py-2">
                      <Link href={`/sales/${s.id}`} className="text-[#C8075F] underline">
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
                      구매 이력이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-3 text-sm font-medium text-zinc-700">발급된 쿠폰</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">쿠폰명</th>
                  <th className="px-3 py-2">유형</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {(couponsData ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      {c.title}
                      <p className="text-xs text-zinc-400">{CAMPAIGN_TYPE_LABELS[c.campaign_type as keyof typeof CAMPAIGN_TYPE_LABELS]}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}
                    </td>
                    <td className="px-3 py-2">
                      {c.redeemed_at ? (
                        <span className="text-zinc-400">사용완료</span>
                      ) : c.expires_at && new Date(c.expires_at) < new Date() ? (
                        <span className="text-zinc-400">만료됨</span>
                      ) : (
                        <span className="font-medium text-green-600">사용가능</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(couponsData ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
                      발급된 쿠폰이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <IssueCouponForm customerId={id} />
      </div>
    </div>
  );
}
