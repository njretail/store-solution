import { requireAdmin, getCurrentStore } from "@/lib/session";
import type { Kiosk, KioskAnnouncement } from "@/lib/types";
import KioskAnnouncementForm from "./KioskAnnouncementForm";
import { toggleKioskAnnouncementActive, deleteKioskAnnouncement } from "./actions";

export default async function KioskAnnouncementsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: kioskData }, { data: announcementData }] = await Promise.all([
    supabase.from("kiosks").select("*").eq("store_id", store.id).order("name"),
    supabase
      .from("kiosk_announcements")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order")
      .order("created_at", { ascending: false }),
  ]);

  const kiosks = (kioskData ?? []) as Kiosk[];
  const announcements = (announcementData ?? []) as KioskAnnouncement[];
  const kioskName = (id: string | null) => kiosks.find((k) => k.id === id)?.name ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">안내멘트 관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <KioskAnnouncementForm kiosks={kiosks} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">문구</th>
              <th className="px-4 py-3">재생 방식</th>
              <th className="px-4 py-3">적용 대상</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a.id} className="border-t border-zinc-100">
                <td className="max-w-[320px] whitespace-normal px-4 py-3">{a.message}</td>
                <td className="px-4 py-3 text-zinc-500">{a.audio_url ? "업로드 오디오" : "브라우저 음성(TTS)"}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {a.kiosk_id ? `${kioskName(a.kiosk_id) ?? "알 수 없는 키오스크"}만` : "전체 공통"}
                </td>
                <td className="px-4 py-3">
                  <form action={toggleKioskAnnouncementActive}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="active" value={String(a.active)} />
                    <button
                      type="submit"
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        a.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {a.active ? "사용 중" : "숨김"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form action={deleteKioskAnnouncement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {announcements.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  등록된 안내멘트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
