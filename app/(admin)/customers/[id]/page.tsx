import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { computeCustomerSegments, TAG_LABELS } from "@/lib/customer-segments";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/types";
import IssueCouponForm from "../IssueCouponForm";
import AdjustPointsForm from "../../points/AdjustPointsForm";
import ResetPinForm from "../../points/ResetPinForm";
import { POINT_KIND_LABELS, type PointLedgerRow, type PointSummary } from "@/lib/points";

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

  // 포인트 (0042_points.sql 실행 전이면 조용히 숨김)
  const [{ data: pointSummaryData }, { data: pointLedgerData }] = await Promise.all([
    supabase.rpc("point_summary", { p_store_id: customer.store_id, p_phone: customer.phone }),
    supabase
      .from("point_ledger")
      .select("id, sale_id, kind, amount, memo, created_at, expires_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const pointSummary = pointSummaryData as PointSummary | null;
  // 비밀번호 초기화 기록 (누가·언제)
  const resetBy = customer.point_pin_reset_by
    ? (await supabase.from("profiles").select("name, email").eq("id", customer.point_pin_reset_by).maybeSingle()).data
    : null;
  const pointLedger = (pointLedgerData ?? []) as Pick<PointLedgerRow, "id" | "sale_id" | "kind" | "amount" | "memo" | "created_at" | "expires_at">[];

  const sales = salesData ?? [];
  const saleIds = sales.map((s) => s.id);
  const { data: itemsData } =
    saleIds.length > 0
      ? await supabase
          .from("sale_items")
          .select("sale_id, product_id, quantity, products(name, categories(name))")
          .in("sale_id", saleIds)
      : { data: [] };

  const items = (
    (itemsData ?? []) as unknown as Array<{
      sale_id: string;
      product_id: string;
      quantity: number;
      products: { name: string; categories: { name: string } | null } | null;
    }>
  ).map((it) => ({
    customerId: id,
    saleId: it.sale_id,
    categoryName: it.products?.categories?.name ?? null,
    productId: it.product_id,
    productName: it.products?.name ?? "상품",
    quantity: it.quantity,
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
          <div className="ml-auto flex flex-wrap gap-6 text-sm text-zinc-600">
            <span>방문 {segment.visitCount}회</span>
            <span>누적 {segment.totalSpent.toLocaleString()}원</span>
            <span>주력상품 {segment.topProductName ?? "-"}</span>
            <span>{segment.preferredTimeLabel}</span>
            <span>
              최근방문 {segment.daysSinceLastVisit === 0 ? "오늘" : `${segment.daysSinceLastVisit}일 전`}
              {segment.isOverdue && <span className="ml-1 font-medium text-amber-600">(뜸해짐)</span>}
            </span>
          </div>
        </div>
      )}

      {pointSummary && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <h2 className="text-sm font-medium text-zinc-700">포인트</h2>
            <span className="text-xl font-semibold text-[#C8075F]">{pointSummary.balance.toLocaleString()}점</span>
            {pointSummary.pending > 0 && <span className="text-sm text-zinc-500">사용 대기 {pointSummary.pending.toLocaleString()}점</span>}
            {pointSummary.expiring_30d > 0 && <span className="text-sm text-amber-600">30일 내 소멸 {pointSummary.expiring_30d.toLocaleString()}점</span>}
            <span className="text-sm text-zinc-500">
              비밀번호 {pointSummary.locked ? "잠김(10분)" : pointSummary.has_pin ? "등록됨" : "미등록 (첫 사용 때 등록)"}
            </span>
          </div>
          {customer.point_pin_reset_at && (
            <p className="text-xs text-zinc-500">
              마지막 비밀번호 초기화: {new Date(customer.point_pin_reset_at).toLocaleString("ko-KR")}
              {resetBy && ` · ${resetBy.name ?? resetBy.email ?? "관리자"}`}
            </p>
          )}
          {(pointSummary.has_pin || pointSummary.locked) && (
            <details className="w-fit rounded border border-zinc-200 px-3 py-2">
              <summary className="cursor-pointer text-xs text-zinc-600">비밀번호 분실 — 초기화하기</summary>
              <div className="mt-2 w-72">
                <ResetPinForm customerId={id} compact />
              </div>
            </details>
          )}
          {!pointSummary.enabled && <p className="text-xs text-zinc-400">이 매장은 포인트가 꺼져 있어요. 포인트관리에서 켤 수 있어요.</p>}
          {pointLedger.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <tbody>
                  {pointLedger.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-100">
                      <td className="py-1.5 pr-3 text-zinc-500">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                      <td className="py-1.5 pr-3">{POINT_KIND_LABELS[r.kind]}</td>
                      <td className={`py-1.5 pr-3 text-right font-medium ${r.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-zinc-500">
                        {r.memo}
                        {r.amount > 0 && r.expires_at && <span className="ml-2 text-xs text-zinc-400">~{new Date(r.expires_at).toLocaleDateString("ko-KR")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

        <div className="flex flex-col gap-6">
          <IssueCouponForm customerId={id} />
          {pointSummary && <AdjustPointsForm customerId={id} />}
        </div>
      </div>
    </div>
  );
}
