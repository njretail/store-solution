import Link from "next/link";
import { requireProfile, getCurrentStore } from "@/lib/session";
import { CHANGE_TRANSFER_STATUS_LABELS, type ChangeTransferRequest, type ChangeTransferStatus } from "@/lib/types";
import { setChangeTransferStatus } from "./actions";
import ChangeTransferForm from "./ChangeTransferForm";

type TabKey = "all" | ChangeTransferStatus;

const TAB_LABELS: Record<TabKey, string> = {
  all: "전체",
  pending: "지급대기",
  paid: "지급완료",
  cancelled: "지급취소",
};

function isTabKey(v: string | undefined): v is TabKey {
  return v === "all" || v === "pending" || v === "paid" || v === "cancelled";
}

export default async function ChangeTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const tab: TabKey = isTabKey(params.status) ? params.status : "all";

  let query = supabase
    .from("change_transfer_requests")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });
  if (tab !== "all") query = query.eq("status", tab);

  const { data } = await query;
  const requests = (data ?? []) as ChangeTransferRequest[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">계좌이체요청내역</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <ChangeTransferForm />

      <div className="flex shrink-0 self-start rounded-md border border-zinc-300 text-sm">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((t, i) => (
          <Link
            key={t}
            href={t === "all" ? "/change-transfers" : `/change-transfers?status=${t}`}
            className={`whitespace-nowrap px-3 py-1.5 ${i > 0 ? "border-l border-zinc-300" : ""} ${
              t === tab ? "bg-[#C8075F] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">요청일시</th>
              <th className="px-4 py-3">고객</th>
              <th className="px-4 py-3">계좌정보</th>
              <th className="px-4 py-3">금액</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">메모</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  {r.customer_name ?? "-"}
                  {r.customer_phone && (
                    <p className="text-xs text-zinc-400">{r.customer_phone}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.bank_name} {r.account_number}
                  <p className="text-xs text-zinc-400">예금주: {r.account_holder}</p>
                </td>
                <td className="px-4 py-3 font-medium">{r.amount.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      r.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : r.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {CHANGE_TRANSFER_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{r.memo ?? "-"}</td>
                <td className="px-4 py-3">
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <form action={setChangeTransferStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="paid" />
                        <button
                          type="submit"
                          className="rounded bg-[#C8075F] px-2 py-1 text-xs text-white hover:bg-[#a80650]"
                        >
                          지급완료
                        </button>
                      </form>
                      <form action={setChangeTransferStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                        >
                          지급취소
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  해당하는 계좌이체 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
