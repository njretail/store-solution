import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { paymentMethodLabel, SALE_STATUS_LABELS, type SaleStatus } from "@/lib/types";
import CancelSaleButton from "../CancelSaleButton";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: sale }, { data: items }] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sale_items")
      .select("id, quantity, unit_price, subtotal, products(name, barcode)")
      .eq("sale_id", id),
  ]);

  if (!sale) return notFound();

  const status = (sale.status ?? "completed") as SaleStatus;
  const lineItems = (items ?? []) as unknown as Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    products: { name: string; barcode: string } | null;
  }>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sales" className="text-sm text-[#C8075F] underline">
            ← 판매내역으로
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">판매내역 상세</h1>
        </div>
        {status === "completed" && <CancelSaleButton saleId={sale.id} />}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-100 px-5 py-3 text-sm font-medium text-zinc-500">
          결제정보
        </h2>
        <dl className="divide-y divide-zinc-100">
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-zinc-500">판매상태</dt>
            <dd
              className={`text-sm font-semibold ${
                status === "cancelled" ? "text-red-600" : "text-zinc-900"
              }`}
            >
              {SALE_STATUS_LABELS[status]}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-zinc-500">결제일시</dt>
            <dd className="text-sm text-zinc-900">
              {new Date(sale.created_at).toLocaleString("ko-KR")}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-zinc-500">결제수단</dt>
            <dd className="text-sm text-zinc-900">{paymentMethodLabel(sale.payment_method)}</dd>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="text-sm text-zinc-500">할인금액</dt>
              <dd className="text-sm text-zinc-900">-{sale.discount_amount.toLocaleString()}원</dd>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-zinc-500">결제금액</dt>
            <dd className="text-lg font-semibold text-[#C8075F]">
              {sale.total_amount.toLocaleString()}원
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-100 px-5 py-3 text-sm font-medium text-zinc-500">
          판매내역
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-5 py-2">상품명</th>
                <th className="px-5 py-2">수량</th>
                <th className="px-5 py-2">단가</th>
                <th className="px-5 py-2">금액</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it) => (
                <tr key={it.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2">
                    {it.products?.name ?? "-"}
                    <p className="text-xs text-zinc-400">{it.products?.barcode}</p>
                  </td>
                  <td className="px-5 py-2">{it.quantity}</td>
                  <td className="px-5 py-2">{it.unit_price.toLocaleString()}원</td>
                  <td className="px-5 py-2">{it.subtotal.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
