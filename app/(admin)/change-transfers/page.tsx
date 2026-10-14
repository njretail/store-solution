import Link from "next/link";
import { requireProfile, getCurrentStore } from "@/lib/session";
import {
  CHANGE_TRANSFER_REASON_LABELS,
  changeTransferCode,
  type ChangeTransferRequest,
  type ChangeTransferStatus,
} from "@/lib/types";
import ChangeTransferForm from "./ChangeTransferForm";
import { StatusBadge } from "./StatusBadge";

type TabKey = "all" | "pending" | "paid";

const TAB_LABELS: Record<TabKey, string> = {
  all: "전체",
  pending: "미처리",
  paid: "완료",
};

type Row = ChangeTransferRequest & { kiosks: { name: string } | null };

function buildHref(params: { status?: string; kiosk?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.kiosk) sp.set("kiosk", params.kiosk);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/change-transfers?${qs}` : "/change-transfers";
}

// 현금관리 > 계좌이체(거스름돈) — 키오스크에서 거스름돈을 못 받은 고객(잔돈 부족·배출 오류)이
// 등록한 계좌이체 요청을 확인하고, 송금 후 "지불 완료"로 처리하는 화면. 카드를 누르면 상세로 간다.
export default async function ChangeTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kiosk?: string; q?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const tab: TabKey = params.status === "pending" || params.status === "paid" ? params.status : "all";
  const kioskFilter = params.kiosk ?? "";
  const q = (params.q ?? "").trim();

  let query = supabase
    .from("change_transfer_requests")
    .select("*, kiosks(name)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (tab !== "all") query = query.eq("status", tab);
  if (kioskFilter) query = query.eq("kiosk_id", kioskFilter);

  const [{ data }, { data: kiosksData }, { data: pendingData }] = await Promise.all([
    query,
    supabase.from("kiosks").select("id, name").eq("store_id", store.id).order("name"),
    supabase
      .from("change_transfer_requests")
      .select("amount")
      .eq("store_id", store.id)
      .eq("status", "pending"),
  ]);

  // 검색: 요청번호·은행·계좌번호·금액 — 건수가 많지 않아 서버에서 걸러낸다.
  const digits = q.replace(/[^0-9]/g, "");
  const rows = ((data ?? []) as Row[]).filter((r) => {
    if (!q) return true;
    return (
      changeTransferCode(r.id).includes(q.toUpperCase()) ||
      r.bank_name.includes(q) ||
      (digits.length >= 3 && r.account_number.replace(/[^0-9]/g, "").includes(digits)) ||
      (digits.length > 0 && String(r.amount) === digits)
    );
  });

  const pendingCount = (pendingData ?? []).length;
  const pendingTotal = (pendingData ?? []).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">계좌이체(거스름돈)</h1>
        <p className="text-sm text-zinc-500">
          {store.name} · 키오스크에서 거스름돈을 못 받은 고객의 계좌이체 요청을 처리합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">미처리</p>
          <p className={`text-2xl font-semibold ${pendingCount > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {pendingCount}건
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">지급할 금액</p>
          <p className="text-2xl font-semibold text-zinc-900">{pendingTotal.toLocaleString()}원</p>
        </div>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {tab !== "all" && <input type="hidden" name="status" value={tab} />}
        <select
          name="kiosk"
          defaultValue={kioskFilter}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm sm:w-56"
        >
          <option value="">전체 키오스크</option>
          {(kiosksData ?? []).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <div className="flex flex-1 gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="요청번호·은행·계좌번호·금액 검색"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
          />
          <button type="submit" className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-50">
            검색
          </button>
        </div>
      </form>

      <div className="flex self-start rounded-lg bg-zinc-100 p-1 text-sm">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((t) => (
          <Link
            key={t}
            href={buildHref({ status: t, kiosk: kioskFilter, q })}
            className={`rounded-md px-4 py-1.5 ${
              t === tab ? "border border-[#C8075F] bg-white font-medium text-[#C8075F]" : "text-zinc-600"
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/change-transfers/${r.id}`}
            className="flex flex-col gap-2 rounded-xl bg-zinc-100 px-5 py-4 hover:bg-zinc-200/70"
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-zinc-900">
                <span className="mr-2 text-base font-medium">금액</span>₩{r.amount.toLocaleString()}
              </p>
              <StatusBadge status={r.status as ChangeTransferStatus} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">발생일시</span>
              <span className="text-zinc-800">
                {new Date(r.created_at).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                ({changeTransferCode(r.id)})
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">계좌</span>
              <span className="text-zinc-800">
                {r.bank_name} / {r.account_number}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">사유 · 키오스크</span>
              <span className="text-zinc-800">
                {r.reason ? CHANGE_TRANSFER_REASON_LABELS[r.reason] : "직접 등록"}
                {r.kiosks?.name ? ` · ${r.kiosks.name}` : ""}
              </span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-400 md:col-span-2">
            해당하는 계좌이체 요청이 없습니다.
          </p>
        )}
      </div>

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        개인정보 최소 수집: 키오스크에서는 은행·계좌번호만 받고 이름·연락처는 받지 않습니다(고객 동의 완료). 송금 전
        은행 앱의 예금주 조회로 확인하세요. 지불 완료·지급 취소로 처리하는 즉시 계좌번호는 끝 4자리만 남기고 자동
        파기됩니다.
      </p>

      <details className="rounded-lg border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">
          + 직접 등록 (전화 접수 등 예외 상황)
        </summary>
        <div className="mt-3">
          <ChangeTransferForm />
        </div>
      </details>
    </div>
  );
}
