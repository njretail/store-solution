import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { DEFAULT_POINT_POLICY, POINT_KIND_LABELS, describePolicy, type PointLedgerRow, type PointPolicy } from "@/lib/points";
import { savePointPolicy } from "./actions";
import AdjustPointsForm from "./AdjustPointsForm";
import ResetPinForm from "./ResetPinForm";

type LedgerLite = Pick<PointLedgerRow, "customer_id" | "kind" | "amount" | "remaining" | "available_at" | "expires_at">;

function serverNow() {
  return Date.now();
}

function summarize(rows: LedgerLite[], now: number) {
  let earned = 0, used = 0, outstanding = 0, pending = 0, expiring = 0, expired = 0;
  const byCustomer = new Map<string, number>();
  for (const r of rows) {
    if (r.kind === "earn") earned += r.amount;
    if (r.kind === "use") used += -r.amount;
    if (r.kind === "cancel_earn") earned += r.amount;
    if (r.kind === "cancel_use") used -= r.amount;
    if (r.remaining <= 0) continue;
    const exp = r.expires_at ? Date.parse(r.expires_at) : null;
    if (exp !== null && exp <= now) { expired += r.remaining; continue; }
    if (Date.parse(r.available_at) > now) { pending += r.remaining; continue; }
    outstanding += r.remaining;
    byCustomer.set(r.customer_id, (byCustomer.get(r.customer_id) ?? 0) + r.remaining);
    if (exp !== null && exp <= now + 30 * 86400_000) expiring += r.remaining;
  }
  return { earned, used, outstanding, pending, expiring, expired, byCustomer };
}

const DAY_OPTIONS = [0, 1, 3, 7, 14, 30];
const UNIT_OPTIONS = [1, 10, 100, 500, 1000];
const EXPIRE_OPTIONS = [0, 6, 12, 24, 36];

export default async function PointsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;
  const sp = await searchParams;

  const { data: policyRow, error: policyError } = await supabase
    .from("point_policies")
    .select("*")
    .eq("store_id", store.id)
    .maybeSingle();

  if (policyError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">포인트관리</h1>
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          포인트 DB가 아직 준비되지 않았어요. Supabase SQL Editor에서 <code>0042_points.sql</code>을 실행해 주세요.
        </p>
      </div>
    );
  }

  const policy: PointPolicy = { ...DEFAULT_POINT_POLICY, ...(policyRow ?? {}), earn_rate: Number(policyRow?.earn_rate ?? DEFAULT_POINT_POLICY.earn_rate) };

  const [ledger, recentRes] = await Promise.all([
    fetchAllPages<LedgerLite>((from, to) =>
      supabase
        .from("point_ledger")
        .select("customer_id, kind, amount, remaining, available_at, expires_at")
        .eq("store_id", store.id)
        .range(from, to)
    ),
    supabase
      .from("point_ledger")
      .select("id, customer_id, sale_id, kind, amount, memo, created_at, customers(phone, name)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const stats = summarize(ledger, serverNow());
  const topIds = [...stats.byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const { data: topCustomers } = topIds.length
    ? await supabase.from("customers").select("id, phone, name").in("id", topIds.map(([id]) => id))
    : { data: [] as { id: string; phone: string; name: string | null }[] };
  const customerOf = new Map((topCustomers ?? []).map((c) => [c.id, c]));
  const recent = (recentRes.data ?? []) as unknown as Array<{
    id: string; customer_id: string; sale_id: string | null; kind: PointLedgerRow["kind"]; amount: number; memo: string | null; created_at: string;
    customers: { phone: string; name: string | null } | null;
  }>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">포인트관리</h1>
        <p className="text-sm text-zinc-500">
          {store.name} · 매장에서 구매한 손님에게 결제금액의 일정 비율을 적립하고, 다음 결제 때 키오스크·판매 화면에서 쓰게 합니다.
        </p>
      </div>

      {sp.saved && <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">포인트 규칙을 저장했어요. 다음 결제부터 적용돼요.</p>}
      {sp.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{sp.error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["사용 가능 잔액", stats.outstanding, "손님들이 지금 쓸 수 있는 포인트 (매장 부채)"],
          ["사용 대기", stats.pending, "적립됐지만 사용 가능일 전"],
          ["30일 내 소멸 예정", stats.expiring, ""],
          ["누적 적립", stats.earned, "취소분 제외"],
          ["누적 사용", stats.used, "취소분 제외"],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{(value as number).toLocaleString()}<span className="ml-0.5 text-sm font-normal">점</span></p>
            {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
          </div>
        ))}
      </div>

      <form action={savePointPolicy} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">적립 규칙</h2>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={policy.enabled} className="h-4 w-4 accent-[#C8075F]" />
            포인트 사용하기
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-3 rounded-md bg-zinc-50 p-4">
            <legend className="text-sm font-medium text-zinc-700">적립</legend>
            <label className="text-sm text-zinc-600">
              적립률 (결제금액의 %)
              <input name="earn_rate" type="number" step="0.1" min={0} max={50} defaultValue={policy.earn_rate} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-right" />
            </label>
            <label className="text-sm text-zinc-600">
              적립 최소 결제금액 (원, 0이면 모든 결제)
              <input name="min_purchase_for_earn" type="number" min={0} step={100} defaultValue={policy.min_purchase_for_earn} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-right" />
            </label>
            <label className="text-sm text-zinc-600">
              사용 가능 시점
              <select name="available_after_days" defaultValue={policy.available_after_days} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5">
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d === 0 ? "적립 즉시 사용" : `적립 ${d}일 뒤부터`}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              유효기간
              <select name="expire_months" defaultValue={policy.expire_months} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5">
                {EXPIRE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m === 0 ? "소멸 없음" : `적립일로부터 ${m}개월`}</option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-md bg-zinc-50 p-4">
            <legend className="text-sm font-medium text-zinc-700">사용</legend>
            <label className="text-sm text-zinc-600">
              최소 사용 포인트 (이만큼 모여야 사용)
              <input name="min_balance_to_use" type="number" min={0} step={100} defaultValue={policy.min_balance_to_use} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-right" />
            </label>
            <label className="text-sm text-zinc-600">
              사용 단위
              <select name="use_unit" defaultValue={policy.use_unit} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5">
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u.toLocaleString()}점 단위</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              1회 최대 사용 (결제금액의 %)
              <input name="max_use_rate" type="number" min={1} max={100} defaultValue={policy.max_use_rate} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-right" />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" name="require_pin" defaultChecked={policy.require_pin} className="h-4 w-4 accent-[#C8075F]" />
              사용할 때 포인트 비밀번호(4자리) 확인 <span className="text-xs text-zinc-400">(권장)</span>
            </label>
          </fieldset>
        </div>

        <div className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-600">
          <p className="mb-1 font-medium text-zinc-700">손님에게 보이는 안내 (지금 저장된 규칙)</p>
          <ul className="list-disc pl-5">
            {describePolicy(policy).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            적립은 쿠폰·할인·포인트 사용분을 뺀 실제 결제금액 기준이에요. 결제를 취소하면 적립분은 회수되고 사용한 포인트는 돌려줘요.
            배송 주문은 적립 대상이 아니에요.
          </p>
        </div>

        <button className="self-end rounded bg-[#C8075F] px-5 py-2 text-sm font-medium text-white hover:bg-[#a80650]">규칙 저장</button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <AdjustPointsForm />
          <ResetPinForm />
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-700">잔액 많은 손님</h2>
            {topIds.length === 0 ? (
              <p className="text-sm text-zinc-400">아직 적립된 포인트가 없어요.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {topIds.map(([id, bal]) => {
                  const c = customerOf.get(id);
                  return (
                    <li key={id} className="flex items-center justify-between py-1.5">
                      <Link href={`/customers/${id}`} className="text-[#C8075F] underline">{c?.name ?? c?.phone ?? "고객"}</Link>
                      <span>{bal.toLocaleString()}점</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <h2 className="px-4 pt-3 text-sm font-medium text-zinc-700">최근 내역</h2>
          <table className="mt-2 w-full whitespace-nowrap text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2">일시</th>
                <th className="px-3 py-2">고객</th>
                <th className="px-3 py-2">구분</th>
                <th className="px-3 py-2 text-right">포인트</th>
                <th className="px-3 py-2">메모</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-500">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2">
                    <Link href={`/customers/${r.customer_id}`} className="text-[#C8075F] underline">{r.customers?.name ?? r.customers?.phone ?? "고객"}</Link>
                  </td>
                  <td className="px-3 py-2">{POINT_KIND_LABELS[r.kind]}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {r.memo}
                    {r.sale_id && <Link href={`/sales/${r.sale_id}`} className="ml-2 text-xs text-[#C8075F] underline">판매</Link>}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-400">아직 내역이 없어요.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
