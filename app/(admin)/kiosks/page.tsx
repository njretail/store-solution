import { requireProfile, getCurrentStore } from "@/lib/session";
import { createKiosk, updateKioskStatus, deleteKiosk } from "./actions";
import { KIOSK_STATUS_LABELS } from "@/lib/types";
import type { Kiosk } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  online: "text-green-600",
  offline: "text-red-600",
  maintenance: "text-amber-600",
};

export default async function KiosksPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("kiosks")
    .select("*")
    .eq("store_id", store.id)
    .order("name");

  const kiosks = (data ?? []) as Kiosk[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">키오스크 관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      {isAdmin && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            + 키오스크 등록
          </summary>
          <form action={createKiosk} className="mt-3 flex gap-2">
            <input
              name="name"
              placeholder="키오스크 이름 (예: 카운터1)"
              required
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              등록
            </button>
          </form>
        </details>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">마지막 갱신</th>
              {isAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {kiosks.map((k) => (
              <tr key={k.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{k.name}</td>
                <td className={`px-4 py-3 font-medium ${STATUS_COLORS[k.status]}`}>
                  {KIOSK_STATUS_LABELS[k.status]}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(k.updated_at).toLocaleString("ko-KR")}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <form action={updateKioskStatus} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={k.id} />
                        <select
                          name="status"
                          defaultValue={k.status}
                          className="rounded border border-zinc-200 px-2 py-1 text-sm"
                        >
                          <option value="online">정상</option>
                          <option value="maintenance">점검중</option>
                          <option value="offline">오프라인</option>
                        </select>
                        <button
                          type="submit"
                          className="text-sm text-zinc-600 hover:text-zinc-900"
                        >
                          변경
                        </button>
                      </form>
                      <form action={deleteKiosk}>
                        <input type="hidden" name="id" value={k.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {kiosks.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-4 py-6 text-center text-zinc-400"
                >
                  등록된 키오스크가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-400">
        지금은 상태를 직접 등록/변경하는 방식이에요. 실제 키오스크 장비가
        자동으로 상태를 보고하게 하려면 사용하시는 키오스크 시스템 정보를
        알려주세요.
      </p>
    </div>
  );
}
