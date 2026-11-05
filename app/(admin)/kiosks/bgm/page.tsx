import { requireAdmin, getCurrentStore } from "@/lib/session";
import type { Kiosk, KioskBgmTrack } from "@/lib/types";
import KioskBgmUploadForm from "./KioskBgmUploadForm";
import {
  updateKioskBgmSettings,
  updateKioskBgmOrder,
  toggleKioskBgmActive,
  deleteKioskBgm,
} from "./actions";

export default async function KioskBgmPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: kioskData }, { data: trackData }] = await Promise.all([
    supabase.from("kiosks").select("*").eq("store_id", store.id).order("name"),
    supabase
      .from("kiosk_bgm_tracks")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order")
      .order("created_at"),
  ]);

  const kiosks = (kioskData ?? []) as Kiosk[];
  const tracks = (trackData ?? []) as KioskBgmTrack[];
  const kioskName = (id: string | null) => kiosks.find((k) => k.id === id)?.name ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">매장 BGM</h1>
        <p className="text-sm text-zinc-500">
          {store.name} · 키오스크가 아래 곡을 순서대로 반복 재생합니다. 안내멘트가 나오는 동안에는
          음량이 자동으로 줄어듭니다.
        </p>
      </div>

      <form
        action={updateKioskBgmSettings}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="bgm_enabled" defaultChecked={store.bgm_enabled ?? true} />
          BGM 사용
        </label>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">음량 (0~100)</label>
          <input
            name="bgm_volume"
            type="number"
            min={0}
            max={100}
            defaultValue={store.bgm_volume ?? 40}
            className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">안내멘트 사이 쉬는 시간 (초, BGM만 흐름)</label>
          <input
            name="announcement_gap_seconds"
            type="number"
            min={0}
            max={300}
            defaultValue={store.announcement_gap_seconds ?? 7}
            className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          설정 저장
        </button>
        <p className="w-full text-xs text-zinc-400">
          바꾼 설정·곡은 키오스크가 화면을 새로 불러올 때 반영됩니다 — 키오스크 목록에서
          &ldquo;새로고침&rdquo; 명령을 보내면 바로 반영돼요.
        </p>
      </form>

      <KioskBgmUploadForm kiosks={kiosks} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">순서</th>
              <th className="px-4 py-3">곡</th>
              <th className="px-4 py-3">미리 듣기</th>
              <th className="px-4 py-3">적용 대상</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  <form action={updateKioskBgmOrder} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue={t.sort_order}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-800">
                      저장
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">{t.title}</td>
                <td className="px-4 py-3">
                  <audio controls preload="none" src={t.audio_url} className="h-8" />
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {t.kiosk_id ? `${kioskName(t.kiosk_id) ?? "알 수 없는 키오스크"}만` : "전체 공통"}
                </td>
                <td className="px-4 py-3">
                  <form action={toggleKioskBgmActive}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(t.active)} />
                    <button
                      type="submit"
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        t.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {t.active ? "재생 중" : "숨김"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form action={deleteKioskBgm}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {tracks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  등록된 곡이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
