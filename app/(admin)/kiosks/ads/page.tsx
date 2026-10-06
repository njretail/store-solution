import { requireAdmin, getCurrentStore } from "@/lib/session";
import type { Kiosk, KioskAd } from "@/lib/types";
import KioskAdUploadForm from "./KioskAdUploadForm";
import { toggleKioskAdActive, deleteKioskAd } from "./actions";

export default async function KioskAdsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: kioskData }, { data: adData }] = await Promise.all([
    supabase.from("kiosks").select("*").eq("store_id", store.id).order("name"),
    supabase
      .from("kiosk_ads")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order")
      .order("created_at", { ascending: false }),
  ]);

  const kiosks = (kioskData ?? []) as Kiosk[];
  const ads = (adData ?? []) as KioskAd[];
  const kioskName = (id: string | null) => kiosks.find((k) => k.id === id)?.name ?? null;
  const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">광고 관리</h1>
        <p className="text-sm text-zinc-500">
          {store.name} · 키오스크 대기화면에 순서대로 돌아가며 노출되는 광고 이미지·영상입니다.
        </p>
      </div>

      <KioskAdUploadForm kiosks={kiosks} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <div key={ad.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
            {isVideo(ad.image_url) ? (
              <video
                src={ad.image_url}
                className="aspect-video w-full rounded object-cover"
                muted
                controls
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.image_url} alt="광고 이미지" className="aspect-video w-full rounded object-cover" />
            )}
            <p className="text-xs text-zinc-500">
              {ad.kiosk_id ? `${kioskName(ad.kiosk_id) ?? "알 수 없는 키오스크"}만` : "전체 키오스크 공통"}
            </p>
            <div className="flex items-center justify-between">
              <form action={toggleKioskAdActive}>
                <input type="hidden" name="id" value={ad.id} />
                <input type="hidden" name="active" value={String(ad.active)} />
                <button
                  type="submit"
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    ad.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {ad.active ? "노출 중" : "숨김"}
                </button>
              </form>
              <form action={deleteKioskAd}>
                <input type="hidden" name="id" value={ad.id} />
                <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                  삭제
                </button>
              </form>
            </div>
          </div>
        ))}
        {ads.length === 0 && (
          <div className="col-span-full rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-zinc-400">
            등록된 광고 이미지가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
