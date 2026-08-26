import { requireAdmin } from "@/lib/session";
import { createCoupon, toggleCoupon, deleteCoupon } from "./actions";
import type { Coupon } from "@/lib/types";

export default async function CouponsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  const coupons = (data ?? []) as Coupon[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">쿠폰관리</h1>
        <p className="text-sm text-zinc-500">
          판매(POS) 화면에서 쿠폰 코드를 입력하면 자동으로 할인이 적용됩니다.
        </p>
      </div>

      <details className="rounded-lg border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">
          + 쿠폰 추가
        </summary>
        <form
          action={createCoupon}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <input
            name="code"
            placeholder="쿠폰 코드"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm uppercase"
          />
          <select
            name="discount_type"
            defaultValue="amount"
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="amount">정액 할인(원)</option>
            <option value="percent">정률 할인(%)</option>
          </select>
          <input
            name="discount_value"
            type="number"
            placeholder="할인 값"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
          >
            등록
          </button>
        </form>
      </details>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">코드</th>
              <th className="px-3 py-2">유형</th>
              <th className="px-3 py-2">할인</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 font-medium text-zinc-900">
                  {c.code}
                </td>
                <td className="px-3 py-2 text-zinc-500">
                  {c.discount_type === "percent" ? "정률" : "정액"}
                </td>
                <td className="px-3 py-2">
                  {c.discount_type === "percent"
                    ? `${c.discount_value}%`
                    : `${c.discount_value.toLocaleString()}원`}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.active
                        ? "text-green-600"
                        : "text-zinc-400"
                    }
                  >
                    {c.active ? "사용중" : "비활성"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(c.active)}
                      />
                      <button
                        type="submit"
                        className="text-zinc-600 hover:text-zinc-900"
                      >
                        {c.active ? "비활성화" : "활성화"}
                      </button>
                    </form>
                    <form action={deleteCoupon}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                  등록된 쿠폰이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
