import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, getCurrentStore } from "@/lib/session";
import {
  CHANGE_TRANSFER_REASON_LABELS,
  changeTransferCode,
  type ChangeTransferRequest,
  type ChangeTransferStatus,
} from "@/lib/types";
import { StatusBadge } from "../StatusBadge";
import CopyAccountButton from "./CopyAccountButton";
import PayoutButtons from "./PayoutButtons";

type Row = ChangeTransferRequest & {
  kiosks: { name: string } | null;
  paid_by_profile: { name: string | null } | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ChangeTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("change_transfer_requests")
    .select("*, kiosks(name), paid_by_profile:profiles!change_transfer_requests_paid_by_fkey(name)")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as Row;
  const pending = r.status === "pending";

  const rows: [string, React.ReactNode][] = [
    ["키오스크", r.kiosks?.name ?? (r.kiosk_id ? "(삭제된 키오스크)" : "직접 등록")],
    ["처리상태", <StatusBadge key="s" status={r.status as ChangeTransferStatus} />],
    ["사유", r.reason ? CHANGE_TRANSFER_REASON_LABELS[r.reason] : "-"],
    ["요청번호", changeTransferCode(r.id)],
    ["발생일시", fmt(r.created_at)],
    [
      "계좌정보",
      <span key="a" className="flex items-center justify-end gap-2">
        {pending && <CopyAccountButton text={`${r.bank_name} ${r.account_number}`} />}
        {r.bank_name}/{r.account_number}
      </span>,
    ],
  ];
  if (r.account_holder) rows.push(["예금주", r.account_holder]);
  rows.push(["금액", <span key="m" className="font-semibold">₩{r.amount.toLocaleString()}</span>]);
  if (r.privacy_consent_at) rows.push(["개인정보 동의", fmt(r.privacy_consent_at)]);
  if (r.status === "paid" && r.paid_at) {
    rows.push(["지불 완료", `${fmt(r.paid_at)}${r.paid_by_profile?.name ? ` · ${r.paid_by_profile.name}` : ""}`]);
  }
  if (r.memo) rows.push(["메모", r.memo]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/change-transfers" aria-label="목록으로" className="rounded p-1 text-zinc-700 hover:bg-zinc-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">계좌이체 상세</h1>
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold text-zinc-800">요청 정보</h2>
        <dl className="flex flex-col gap-4 rounded-2xl bg-zinc-100 px-5 py-5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-zinc-500">{label}</dt>
              <dd className="break-all text-right text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {pending ? (
        <PayoutButtons id={r.id} amount={r.amount} account={`${r.bank_name} ${r.account_number}`} />
      ) : (
        <p className="rounded-lg bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-500">
          {r.status === "paid" ? "지불 완료된 요청입니다." : "취소된 요청입니다."} 계좌번호는 끝 4자리만 남기고
          파기되었습니다.
        </p>
      )}
    </div>
  );
}
