import { requireAdmin, getCurrentStore } from "@/lib/session";
import {
  AGENCY_SERVICES,
  AGENCY_STATUS_LABELS,
  isAgencyConfigured,
  listAgencyRequests,
} from "@/lib/homepage-agency";
import AgencyRequestForm from "./AgencyRequestForm";

export default async function AgencyPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const configured = isAgencyConfigured();
  const requests = configured ? await listAgencyRequests(store.id) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">대행 신청</h1>
        <p className="text-sm text-zinc-500">
          {store.name} — 매장 운영에 필요한 업무를 선택해 주세요. 본사에서 매장 상황을 확인한 뒤 대행 범위와
          일정을 안내해 드립니다.
        </p>
      </div>

      {!configured && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          대행 신청 연동이 아직 설정되지 않아 지금은 신청을 보낼 수 없어요. 본사에 문의해 주세요.
        </p>
      )}

      <AgencyRequestForm
        services={AGENCY_SERVICES}
        defaultName={profile.name ?? ""}
        defaultPhone={profile.phone ?? ""}
        disabled={!configured}
      />

      <div>
        <h2 className="mb-3 text-base font-medium text-zinc-700">내 신청 내역</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">신청일시</th>
                <th className="px-4 py-3">서비스</th>
                <th className="px-4 py-3">신청자</th>
                <th className="px-4 py-3">내용</th>
                <th className="px-4 py-3">진행 상태</th>
              </tr>
            </thead>
            <tbody>
              {(requests ?? []).map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-500">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3">{r.service_type}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-sm text-zinc-500">{r.message ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        r.status === "new"
                          ? "bg-amber-100 text-amber-700"
                          : r.status === "contacted"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {AGENCY_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(requests ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    {configured && requests === null ? "신청 내역을 불러오지 못했습니다." : "아직 신청한 내역이 없습니다."}
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
