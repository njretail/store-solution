import Link from "next/link";
import { requireProfile, getCurrentStore } from "@/lib/session";
import {
  CUSTOMER_VOICE_KIND_LABELS,
  CUSTOMER_VOICE_STATUS_LABELS,
  CUSTOMER_VOICE_TAG_LABELS,
  type CustomerVoice,
  type CustomerVoiceKind,
  type CustomerVoiceStatus,
} from "@/lib/types";
import { updateCustomerVoice } from "./actions";

type KindTab = "all" | CustomerVoiceKind;
type StatusFilter = "all" | CustomerVoiceStatus;

const KIND_TABS: KindTab[] = ["all", "product_request", "complaint", "compliment", "other"];
const STATUS_FILTERS: StatusFilter[] = ["all", "new", "reviewed", "done"];
const SUMMARY_DAYS = 30;

const KIND_BADGE: Record<CustomerVoiceKind, string> = {
  product_request: "bg-[#C8075F]/10 text-[#C8075F]",
  complaint: "bg-amber-100 text-amber-800",
  compliment: "bg-green-100 text-green-800",
  other: "bg-zinc-200 text-zinc-700",
};

const STATUS_BADGE: Record<CustomerVoiceStatus, string> = {
  new: "bg-red-100 text-red-700",
  reviewed: "bg-blue-100 text-blue-700",
  done: "bg-zinc-200 text-zinc-600",
};

type Row = CustomerVoice & { kiosks: { name: string } | null };

function buildHref(kind: KindTab, status: StatusFilter) {
  const sp = new URLSearchParams();
  if (kind !== "all") sp.set("kind", kind);
  if (status !== "all") sp.set("status", status);
  const qs = sp.toString();
  return qs ? `/customer-voice?${qs}` : "/customer-voice";
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function countTags(rows: Pick<CustomerVoice, "tags">[]) {
  const counts = new Map<string, number>();
  for (const r of rows) for (const tag of r.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function TagBars({ title, entries }: { title: string; entries: [string, number][] }) {
  const max = entries[0]?.[1] ?? 0;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p className="mb-3 text-sm font-medium text-zinc-700">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-400">아직 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(([tag, n]) => (
            <li key={tag} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-zinc-700">{CUSTOMER_VOICE_TAG_LABELS[tag] ?? tag}</span>
              <span className="h-2.5 flex-1 rounded-full bg-zinc-100">
                <span
                  className="block h-2.5 rounded-full bg-[#C8075F]"
                  style={{ width: `${Math.max(6, (n / max) * 100)}%` }}
                />
              </span>
              <span className="w-10 text-right font-medium text-zinc-900">{n}건</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 고객의 소리 — 키오스크에서 고객이 남긴 원하는 상품 요청·불편 사항·칭찬을 모아 보고,
// 확인함/반영 완료로 처리하는 화면. 위쪽 집계로 "어떤 상품을 들여놓을지" 판단을 돕는다.
export default async function CustomerVoicePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const kind: KindTab = (KIND_TABS as string[]).includes(params.kind ?? "") ? (params.kind as KindTab) : "all";
  const status: StatusFilter = (STATUS_FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all";

  let query = supabase
    .from("customer_voices")
    .select("*, kiosks(name)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (kind !== "all") query = query.eq("kind", kind);
  if (status !== "all") query = query.eq("status", status);

  const since = daysAgoIso(SUMMARY_DAYS);
  const [{ data }, { data: recentData }, { count: newCount }] = await Promise.all([
    query,
    supabase.from("customer_voices").select("kind, tags").eq("store_id", store.id).gte("created_at", since),
    supabase
      .from("customer_voices")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", "new"),
  ]);

  const rows = (data ?? []) as Row[];
  const recent = (recentData ?? []) as Pick<CustomerVoice, "kind" | "tags">[];
  const recentRequests = recent.filter((r) => r.kind === "product_request");
  const recentComplaints = recent.filter((r) => r.kind === "complaint");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">고객의 소리</h1>
        <p className="text-sm text-zinc-500">
          {store.name} · 키오스크에서 고객이 남긴 원하는 상품 요청과 매장 이용 의견입니다(익명).
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">새 의견</p>
          <p className={`text-2xl font-semibold ${(newCount ?? 0) > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {newCount ?? 0}건
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">상품 요청 (최근 {SUMMARY_DAYS}일)</p>
          <p className="text-2xl font-semibold text-zinc-900">{recentRequests.length}건</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
          <p className="text-sm text-zinc-500">불편 사항 (최근 {SUMMARY_DAYS}일)</p>
          <p className="text-2xl font-semibold text-zinc-900">{recentComplaints.length}건</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TagBars title={`많이 요청된 상품 분류 (최근 ${SUMMARY_DAYS}일)`} entries={countTags(recentRequests)} />
        <TagBars title={`자주 나온 불편 사항 (최근 ${SUMMARY_DAYS}일)`} entries={countTags(recentComplaints)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap self-start rounded-lg bg-zinc-100 p-1 text-sm">
          {KIND_TABS.map((k) => (
            <Link
              key={k}
              href={buildHref(k, status)}
              className={`rounded-md px-3 py-1.5 ${
                k === kind ? "border border-[#C8075F] bg-white font-medium text-[#C8075F]" : "text-zinc-600"
              }`}
            >
              {k === "all" ? "전체" : CUSTOMER_VOICE_KIND_LABELS[k]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-sm">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={buildHref(kind, s)}
              className={`rounded-full px-3 py-1 ${
                s === status ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {s === "all" ? "모든 상태" : CUSTOMER_VOICE_STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-xl bg-zinc-100 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_BADGE[r.kind]}`}>
                {CUSTOMER_VOICE_KIND_LABELS[r.kind]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                {CUSTOMER_VOICE_STATUS_LABELS[r.status]}
              </span>
            </div>
            {r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-zinc-700">
                    {CUSTOMER_VOICE_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
            {r.message && <p className="whitespace-pre-wrap text-sm text-zinc-900">{r.message}</p>}
            <p className="text-xs text-zinc-500">
              {new Date(r.created_at).toLocaleString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {r.kiosks?.name ? ` · ${r.kiosks.name}` : ""}
            </p>
            <form action={updateCustomerVoice} className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
              <input type="hidden" name="id" value={r.id} />
              <input
                name="admin_note"
                defaultValue={r.admin_note ?? ""}
                placeholder="처리 메모 (예: 다음 발주에 제로콜라 추가)"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="status"
                  value="reviewed"
                  className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
                >
                  확인함
                </button>
                <button
                  type="submit"
                  name="status"
                  value="done"
                  className="flex-1 rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
                >
                  반영 완료
                </button>
                {r.status !== "new" && (
                  <button
                    type="submit"
                    name="status"
                    value="new"
                    className="rounded px-2 py-1.5 text-xs text-zinc-500 underline"
                  >
                    되돌리기
                  </button>
                )}
              </div>
            </form>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-400 md:col-span-2">
            해당하는 의견이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
