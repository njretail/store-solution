import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Store } from "@/lib/types";
import { KIOSK_LANGS, KIOSK_LANG_LABELS, type KioskLang } from "@/lib/kiosk-i18n";
import { KIOSK_VOICE_STRINGS } from "@/lib/kiosk-voice-i18n";
import VoiceForm from "./VoiceForm";

function isKioskLang(v: string | undefined): v is KioskLang {
  return !!v && (KIOSK_LANGS as string[]).includes(v);
}

// 고객의 소리 — 무인매장이라 원하는 상품이나 불편한 점을 말할 직원이 없어서, 고객이
// 키오스크에서 직접 남기는 공개 화면. 서비스 롤로만 조회한다. 언어는 메인 화면에서 고른
// 값을 ?lang= 쿼리로 이어받는다(거스름돈 요청 화면과 같은 방식).
export default async function KioskVoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lang: KioskLang = isKioskLang(langParam) ? langParam : "ko";
  const t = KIOSK_VOICE_STRINGS[lang];

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("id, store_id").eq("id", id).maybeSingle();
  if (!kiosk) return notFound();

  const { data: store } = await admin.from("stores").select("*").eq("id", kiosk.store_id).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-10 text-white">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-zinc-900">
        <div className="mb-3 flex flex-wrap justify-end gap-1">
          {KIOSK_LANGS.map((l) => (
            <a
              key={l}
              href={`/kiosk/${id}/voice?lang=${l}`}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                l === lang ? "bg-[#C8075F] text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {KIOSK_LANG_LABELS[l]}
            </a>
          ))}
        </div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {(store as Store | null)?.name ?? "매장"} · {t.subtitle}
        </p>
        <VoiceForm kioskId={kiosk.id} lang={lang} />
      </div>
    </div>
  );
}
