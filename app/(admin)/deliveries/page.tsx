import { requireProfile, getCurrentStore } from "@/lib/session";
import {
  startPreparingDelivery,
  startOutForDelivery,
  markDelivered,
  cancelDelivery,
  updateDeliverySettings,
} from "./actions";
import DeliveryOrderForm from "./DeliveryOrderForm";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from "@/lib/types";

type DeliveryRow = {
  id: string;
  total_amount: number;
  delivery_fee: number;
  delivery_status: DeliveryStatus | null;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_memo: string | null;
  kiosk_label: string | null;
  created_at: string;
};

export default async function DeliveriesPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("sales")
    .select(
      "id, total_amount, delivery_fee, delivery_status, delivery_address, delivery_phone, delivery_memo, kiosk_label, created_at"
    )
    .eq("store_id", store.id)
    .eq("is_delivery", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const orders = (data ?? []) as DeliveryRow[];
  const open = orders.filter(
    (o) => o.delivery_status !== "delivered" && o.delivery_status !== "cancelled"
  );
  const closed = orders.filter(
    (o) => o.delivery_status === "delivered" || o.delivery_status === "cancelled"
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">배송주문건</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        키오스크에서 구매자가 &ldquo;배송으로 받기&rdquo;를 선택한 주문이 여기 모여요. 아직
        실제 키오스크 하드웨어 연동 전이라 지금은 아래에서 직접 등록(전화주문 등)해서 쓸 수
        있고, 나중에 키오스크가 연결되면 같은 화면에 자동으로 들어오도록 연동 지점을 미리
        만들어뒀어요. 배송요청 → 상품준비중 → 배송중 → 배송완료 순서로 진행되고, 배송요청
        단계에서만 취소할 수 있어요.
      </p>

      {profile.role === "admin" && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            배송비 / 무료배송 기준 설정
          </summary>
          <form action={updateDeliverySettings} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-zinc-500">기본 배송비</label>
              <input
                name="default_delivery_fee"
                type="number"
                min={0}
                placeholder="예: 3000"
                defaultValue={store.default_delivery_fee}
                className="mt-1 w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">무료배송 기준금액</label>
              <input
                name="free_shipping_threshold"
                type="number"
                min={0}
                placeholder="예: 20000 (비우면 무료배송 없음)"
                defaultValue={store.free_shipping_threshold ?? ""}
                className="mt-1 w-56 rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              저장
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            무료배송 기준금액 이상 주문이면 배송비가 자동으로 0원이 돼요. 비워두면 항상 기본
            배송비가 부과돼요.
          </p>
        </details>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">배송주문 등록</h2>
        <DeliveryOrderForm
          storeId={store.id}
          defaultDeliveryFee={store.default_delivery_fee}
          freeShippingThreshold={store.free_shipping_threshold}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">진행중 ({open.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">주문일시</th>
                <th className="px-4 py-3">배송지</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {open.map((o) => {
                const status = (o.delivery_status ?? "requested") as DeliveryStatus;
                return (
                  <tr key={o.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(o.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      {o.delivery_address ?? "-"}
                      {o.delivery_memo && (
                        <p className="mt-0.5 text-xs text-zinc-400">{o.delivery_memo}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{o.delivery_phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      {o.total_amount.toLocaleString()}원
                      <p className="text-xs text-zinc-400">
                        {o.delivery_fee > 0 ? `배송비 ${o.delivery_fee.toLocaleString()}원 포함` : "무료배송"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{DELIVERY_STATUS_LABELS[status]}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        {status === "requested" && (
                          <>
                            <form action={startPreparingDelivery}>
                              <input type="hidden" name="id" value={o.id} />
                              <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                                준비 시작
                              </button>
                            </form>
                            <form action={cancelDelivery}>
                              <input type="hidden" name="id" value={o.id} />
                              <button type="submit" className="text-red-500 hover:text-red-700">
                                취소
                              </button>
                            </form>
                          </>
                        )}
                        {status === "preparing" && (
                          <form action={startOutForDelivery}>
                            <input type="hidden" name="id" value={o.id} />
                            <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                              배송 시작
                            </button>
                          </form>
                        )}
                        {status === "out_for_delivery" && (
                          <form action={markDelivered}>
                            <input type="hidden" name="id" value={o.id} />
                            <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                              배송완료
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {open.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    진행중인 배송주문이 없습니다.
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
                <th className="px-4 py-3">주문일시</th>
                <th className="px-4 py-3">배송지</th>
                <th className="px-4 py-3">금액</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((o) => {
                const status = (o.delivery_status ?? "requested") as DeliveryStatus;
                return (
                  <tr key={o.id} className="border-t border-zinc-100 text-zinc-400">
                    <td className="px-4 py-3">{new Date(o.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3">{o.delivery_address ?? "-"}</td>
                    <td className="px-4 py-3">{o.total_amount.toLocaleString()}원</td>
                    <td className="px-4 py-3">{DELIVERY_STATUS_LABELS[status]}</td>
                  </tr>
                );
              })}
              {closed.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    완료/취소된 배송주문이 없습니다.
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
