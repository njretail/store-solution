import { requireAdmin, getCurrentStore } from "@/lib/session";
import { ANNOUNCEMENT_PLAY_AT, type Kiosk, type KioskAnnouncement } from "@/lib/types";
import KioskAnnouncementForm from "./KioskAnnouncementForm";
import PreviewAnnouncementButton from "./PreviewAnnouncementButton";
import {
  toggleKioskAnnouncementActive,
  deleteKioskAnnouncement,
  updateKioskAnnouncement,
} from "./actions";

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
      .order("play_at")
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
              <th className="px-4 py-3">재생 시점</th>
              <th className="px-4 py-3">순서</th>
              <th className="px-4 py-3">문구</th>
              <th className="px-4 py-3">재생 방식</th>
              <th className="px-4 py-3">적용 대상</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a.id} className="border-t border-zinc-100 align-top">
                {/* 표 안에 form을 둘 수 없어서, 칸마다 form 속성으로 같은 수정 form에 묶는다. */}
                <td className="px-4 py-3">
                  <select
                    form={`edit-${a.id}`}
                    name="play_at"
                    defaultValue={a.play_at ?? "idle"}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    {ANNOUNCEMENT_PLAY_AT.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    form={`edit-${a.id}`}
                    name="sort_order"
                    type="number"
                    defaultValue={a.sort_order}
                    className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="min-w-[280px] whitespace-normal px-4 py-3">
                  <textarea
                    form={`edit-${a.id}`}
                    name="message"
                    defaultValue={a.message}
                    rows={2}
                    required
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <form id={`edit-${a.id}`} action={updateKioskAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        수정 저장
                      </button>
                    </form>
                    <PreviewAnnouncementButton message={a.message} audioUrl={a.audio_url} />
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{a.audio_url ? "업로드 오디오" : "기기 음성(TTS)"}</td>
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
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
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
