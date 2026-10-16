import { requireAdmin, getCurrentStore, getAccessibleStores } from "@/lib/session";
import { STOCK_TRANSFER_REASON_LABELS, type StockTransfer } from "@/lib/types";
import StoreTransferForm from "./StoreTransferForm";

// 매장 간 재고이동 — 지금 선택된 매장에서 다른 매장으로 재고를 옮기고, 보낸/받은 내역을 본다.
export default async function StoreTransfersPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const stores = await getAccessibleStores(supabase);
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "(알 수 없는 매장)";

  const { data, error } = await supabase
    .from("stock_transfers")
    .select("*")
    .or(`from_store_id.eq.${store.id},to_store_id.eq.${store.id}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const transfers = (data ?? []) as StockTransfer[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">매장 간 재고이동</h1>
        <p className="text-sm text-zinc-500">{store.name}에서 보내기</p>
        <p className="mt-2 text-sm text-zinc-500">
          옮길 상품의 바코드를 찍고 수량과 받는 매장만 고르면, 이 매장 재고는 빠지고 받는 매장 재고는 늘어납니다.
          받는 매장에 없는 상품이면 같은 정보로 자동 등록돼요. 다른 매장에서 보내려면 왼쪽 아래 매장 전환에서 매장을
          바꾸세요.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          재고이동 기능을 쓰려면 DB 업데이트(0036)가 필요합니다. 관리자에게 문의하세요.
        </p>
      )}

      <StoreTransferForm
        currentStore={{ id: store.id, name: store.name }}
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
      />

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">최근 이동 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">일시</th>
                <th className="px-4 py-3">구분</th>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3">상대 매장</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3">소비기한</th>
                <th className="px-4 py-3">메모</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const sent = t.from_store_id === store.id;
                return (
                  <tr key={t.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-zinc-500">{new Date(t.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          sent ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {sent ? "보냄" : "받음"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.product_name}
                      <p className="text-xs text-zinc-400">{t.barcode}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {sent ? "-" : "+"}
                      {t.quantity.toLocaleString()}개
                    </td>
                    <td className="px-4 py-3">
                      {storeName(sent ? t.to_store_id : t.from_store_id)}
                      {t.created_product && sent && <p className="text-xs text-zinc-400">상품 자동 등록됨</p>}
                    </td>
                    <td className="px-4 py-3">{STOCK_TRANSFER_REASON_LABELS[t.reason]}</td>
                    <td className="px-4 py-3 text-zinc-500">{t.expiry_date ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">{t.memo ?? "-"}</td>
                  </tr>
                );
              })}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                    아직 이동 내역이 없습니다.
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
