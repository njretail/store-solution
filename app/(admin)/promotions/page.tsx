import { requireAdmin, getCurrentStore } from "@/lib/session";
import { togglePromotion, deletePromotion } from "./actions";
import PromotionForm from "./PromotionForm";

type PromotionRow = {
  id: string;
  discount_type: "amount" | "percent";
  discount_value: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  products: { name: string; barcode: string; sell_price: number } | null;
};

export default async function PromotionsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("promotions")
    .select("id, discount_type, discount_value, starts_at, ends_at, active, products(name, barcode, sell_price)")
    .eq("store_id", store.id)
    .order("starts_at", { ascending: false })
    .limit(200);

  const promotions = (data ?? []) as unknown as PromotionRow[];
  const now = new Date();

  function status(p: PromotionRow): "진행중" | "예정" | "종료" | "중지됨" {
    if (!p.active) return "중지됨";
    if (new Date(p.ends_at) <= now) return "종료";
    if (new Date(p.starts_at) > now) return "예정";
    return "진행중";
  }

  const STATUS_STYLE: Record<string, string> = {
    진행중: "bg-green-100 text-green-700",
    예정: "bg-blue-100 text-blue-700",
    종료: "bg-zinc-100 text-zinc-500",
    중지됨: "bg-zinc-100 text-zinc-400",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">기간한정 할인</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <p className="text-sm text-zinc-500">
        상품을 바코드로 찾아 기간을 정해두면, 그 기간 동안 실시간 장바구니(POS)에서
        결제할 때 자동으로 할인가가 적용돼요(쿠폰 코드를 따로 입력할 필요 없음).
      </p>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">새 할인 등록</h2>
        <PromotionForm storeId={store.id} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">등록된 할인 ({promotions.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">할인</th>
                <th className="px-4 py-3">기간</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => {
                const st = status(p);
                return (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      {p.products?.name ?? "-"}
                      <p className="text-xs text-zinc-400">{p.products?.barcode}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.discount_type === "percent"
                        ? `${p.discount_value}%`
                        : `${p.discount_value.toLocaleString()}원`}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(p.starts_at).toLocaleString("ko-KR")} ~{" "}
                      {new Date(p.ends_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[st]}`}>
                        {st}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <form action={togglePromotion}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value={String(p.active)} />
                          <button type="submit" className="text-zinc-600 hover:text-zinc-900">
                            {p.active ? "중지" : "재개"}
                          </button>
                        </form>
                        <form action={deletePromotion}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="text-red-500 hover:text-red-700">
                            삭제
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {promotions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    등록된 기간한정 할인이 없습니다.
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
