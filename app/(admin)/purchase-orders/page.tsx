import { requireAdmin, getCurrentStore } from "@/lib/session";
import { markOrderReceived, cancelOrder } from "./actions";
import {
  PURCHASE_ORDER_CHANNEL_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderChannel,
  type PurchaseOrderSource,
  type PurchaseOrderStatus,
} from "@/lib/types";

type OrderRow = {
  id: string;
  quantity: number;
  channel: PurchaseOrderChannel;
  source: PurchaseOrderSource;
  status: PurchaseOrderStatus;
  coupang_link: string | null;
  created_at: string;
  products: { name: string; barcode: string } | null;
};

const CHANNEL_STYLE: Record<PurchaseOrderChannel, string> = {
  hq: "bg-blue-100 text-blue-700",
  coupang: "bg-orange-100 text-orange-700",
};

const SOURCE_LABEL: Record<PurchaseOrderSource, string> = {
  auto: "자동",
  manual: "수동",
};

export default async function PurchaseOrdersPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("purchase_orders")
    .select("id, quantity, channel, source, status, coupang_link, created_at, products(name, barcode)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const orders = (data ?? []) as unknown as OrderRow[];
  const open = orders.filter((o) => o.status === "pending" || o.status === "ordered");
  const closed = orders.filter((o) => o.status === "received" || o.status === "cancelled");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">발주관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        자동발주(재고가 기준 이하로 떨어진 상품 중 자동발주가 켜진 상품)와 수동발주 내역이에요.
        본부 발주는 대기중 상태로 쌓이고, 쿠팡 발주는 링크를 클릭해 결제까지 완료해야 진행돼요.
        실제 재고 반영은{" "}
        <a href="/stock-in" className="text-[#C8075F] underline">
          입고 등록
        </a>
        에서 해주세요.
      </p>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">진행중 ({open.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">채널</th>
                <th className="px-4 py-3">출처</th>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">수량</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">요청일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {open.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CHANNEL_STYLE[o.channel]}`}>
                      {PURCHASE_ORDER_CHANNEL_LABELS[o.channel]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{SOURCE_LABEL[o.source]}</td>
                  <td className="px-4 py-3">
                    {o.products?.name ?? "-"}
                    {o.coupang_link && (
                      <a
                        href={o.coupang_link}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-xs text-[#C8075F] underline"
                      >
                        쿠팡에서 결제하기
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">{o.quantity}</td>
                  <td className="px-4 py-3 text-zinc-500">{PURCHASE_ORDER_STATUS_LABELS[o.status]}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <form action={markOrderReceived}>
                        <input type="hidden" name="id" value={o.id} />
                        <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                          입고완료
                        </button>
                      </form>
                      <form action={cancelOrder}>
                        <input type="hidden" name="id" value={o.id} />
                        <button type="submit" className="text-red-500 hover:text-red-700">
                          취소
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {open.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                    진행중인 발주가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">완료/취소</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">채널</th>
                <th className="px-4 py-3">출처</th>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">수량</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">요청일</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100 text-zinc-400">
                  <td className="px-4 py-3">{PURCHASE_ORDER_CHANNEL_LABELS[o.channel]}</td>
                  <td className="px-4 py-3">{SOURCE_LABEL[o.source]}</td>
                  <td className="px-4 py-3">{o.products?.name ?? "-"}</td>
                  <td className="px-4 py-3">{o.quantity}</td>
                  <td className="px-4 py-3">{PURCHASE_ORDER_STATUS_LABELS[o.status]}</td>
                  <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
              {closed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    완료/취소된 발주가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
