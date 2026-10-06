"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { Kiosk, KioskAd, KioskAnnouncement, KioskStatus, Product, Store } from "@/lib/types";
import { KIOSK_LANGS, KIOSK_LANG_LABELS, KIOSK_STRINGS, type KioskLang } from "@/lib/kiosk-i18n";

const AD_INTERVAL_MS = 7000;
const ANNOUNCEMENT_INTERVAL_MS = 20000;
const POLL_INTERVAL_MS = 20000;
const LANG_STORAGE_KEY = "kiosk-lang";
const LARGE_TEXT_STORAGE_KEY = "kiosk-large-text";
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function LangSwitcher({ lang, onChange }: { lang: KioskLang; onChange: (l: KioskLang) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-white/90 p-1 shadow">
      {KIOSK_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            l === lang ? "bg-[#C8075F] text-white" : "text-zinc-600"
          }`}
        >
          {KIOSK_LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

function BoardBarcode({ barcode, name, price }: { barcode: string; name: string; price: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, barcode, { format: "CODE128", height: 60, displayValue: false, margin: 4 });
    } catch {
      // barcode 값이 CODE128로 인코딩 안 되면 그림 없이 텍스트만 보여준다.
    }
  }, [barcode]);

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-4 text-zinc-900">
      <p className="text-base font-semibold">{name}</p>
      <p className="text-sm text-zinc-500">{price.toLocaleString()}원</p>
      <svg ref={ref} />
      <p className="font-mono text-xs text-zinc-400">{barcode}</p>
    </div>
  );
}

type BoardProduct = Pick<Product, "id" | "barcode" | "name" | "sell_price">;

export default function KioskScreen({
  kiosk,
  store,
  ads,
  announcements,
  boardProducts,
}: {
  kiosk: Kiosk;
  store: Store | null;
  ads: KioskAd[];
  announcements: KioskAnnouncement[];
  boardProducts: BoardProduct[];
}) {
  const [started, setStarted] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const [status, setStatus] = useState<KioskStatus>(kiosk.status);
  const [lang, setLang] = useState<KioskLang>("ko");
  const [largeText, setLargeText] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastCommandAtRef = useRef<string | null>(kiosk.remote_command_at);
  const t = KIOSK_STRINGS[lang];

  // 언어·큰글씨 설정은 이 키오스크 기기에서 계속 쓰는 값이라 localStorage에 남겨서
  // 다음에 화면을 열었을 때도(새로고침/재부팅 후) 유지되게 한다. 서버 렌더링 시점엔
  // localStorage가 없어서 항상 기본값(ko/보통크기)으로 그려지고, 마운트 후 이 effect가
  // 저장된 값으로 갱신한다 — useState 지연 초기화로 바꾸면 SSR 결과와 클라이언트 첫
  // 렌더가 달라져(hydration mismatch) 오히려 더 큰 문제가 생긴다.
  /* eslint-disable react-hooks/set-state-in-effect -- SSR엔 localStorage가 없어
     기본값으로 그려지고, 마운트 후 저장된 값으로 갱신하는 의도된 패턴. useState
     지연 초기화로 바꾸면 서버 렌더와 클라이언트 첫 렌더가 달라져(hydration
     mismatch) 오히려 더 큰 문제가 생긴다. */
  useEffect(() => {
    setLang(loadStored(LANG_STORAGE_KEY, "ko") as KioskLang);
    setLargeText(loadStored(LARGE_TEXT_STORAGE_KEY, "0") === "1");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function changeLang(l: KioskLang) {
    setLang(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // 저장 실패해도 이번 화면 세션에서는 그대로 적용된다.
    }
  }

  function toggleLargeText() {
    setLargeText((v) => {
      const next = !v;
      try {
        localStorage.setItem(LARGE_TEXT_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // 무시
      }
      return next;
    });
  }

  // 광고 슬라이드쇼
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setAdIndex((i) => (i + 1) % ads.length), AD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  // 안내멘트 순환 재생 — 화면을 터치해서 시작한 뒤부터만(브라우저 자동재생 제한 때문).
  // 안내멘트 문구 자체는 관리자가 입력한 그대로라 번역하지 않는다.
  useEffect(() => {
    if (!started || announcements.length === 0) return;
    let i = 0;
    const play = () => {
      const a = announcements[i % announcements.length];
      i += 1;
      if (a.audio_url && audioRef.current) {
        audioRef.current.src = a.audio_url;
        audioRef.current.play().catch(() => {});
      } else if ("speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(a.message);
        utter.lang = "ko-KR";
        window.speechSynthesis.speak(utter);
      }
    };
    play();
    const timer = setInterval(play, ANNOUNCEMENT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [started, announcements]);

  // 원격 관리 — 20초마다 상태를 확인해서, 상태가 바뀌면 화면에 반영하고
  // 새로고침 명령(remote_command_at 변경)이 오면 새로고침한다.
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/kiosk/${kiosk.id}/state`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: KioskStatus;
          remote_command_at: string | null;
        };
        setStatus(data.status);
        if (data.remote_command_at && data.remote_command_at !== lastCommandAtRef.current) {
          location.reload();
        }
      } catch {
        // 네트워크 일시 오류는 다음 폴링에서 다시 시도
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [kiosk.id]);

  if (status === "maintenance" || status === "offline") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-900 text-white">
        <p className="text-3xl font-semibold">
          {status === "maintenance" ? t.maintenanceTitle : t.offlineTitle}
        </p>
        <p className="text-zinc-400">{t.maintenanceBody}</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="relative min-h-screen" style={{ zoom: largeText ? 1.25 : 1 }}>
        <div className="absolute right-4 top-4 z-10">
          <LangSwitcher lang={lang} onChange={changeLang} />
        </div>
        <button
          type="button"
          onClick={() => {
            // 첫 터치에서 TTS/오디오 자동재생 제한을 풀어둔다.
            if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
            audioRef.current?.play().catch(() => {});
            setStarted(true);
          }}
          className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#C8075F] text-white"
        >
          <p className="text-4xl font-bold">{store?.name ?? "무인매장"}</p>
          <p className="text-xl">{t.tapToStart}</p>
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col bg-zinc-950 text-white"
      style={{ zoom: largeText ? 1.25 : 1 }}
    >
      <audio ref={audioRef} />

      {kiosk.banner_message && (
        <div className="bg-[#C8075F] px-6 py-2 text-center text-lg font-medium">
          {kiosk.banner_message}
        </div>
      )}

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {ads.length > 0 ? (
          ads.map((ad, i) =>
            VIDEO_EXT.test(ad.image_url) ? (
              <video
                key={ad.id}
                src={ad.image_url}
                autoPlay
                muted
                loop
                playsInline
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === adIndex ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={ad.id}
                src={ad.image_url}
                alt="광고"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === adIndex ? "opacity-100" : "opacity-0"
                }`}
              />
            )
          )
        ) : (
          <p className="text-2xl text-zinc-500">{store?.name ?? "무인매장"}</p>
        )}
      </div>

      {kiosk.notice_message && (
        <div className="bg-zinc-900 px-6 py-3 text-center text-sm text-zinc-300">
          {kiosk.notice_message}
        </div>
      )}

      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
        <a
          href={`/kiosk/${kiosk.id}/change-request?lang=${lang}`}
          className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow"
        >
          {t.changeRequestButton}
        </a>
        <button
          type="button"
          onClick={toggleLargeText}
          className="rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-zinc-900 shadow"
          aria-pressed={largeText}
        >
          {largeText ? "A−" : "A+"}
        </button>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <LangSwitcher lang={lang} onChange={changeLang} />
        {boardProducts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowBoard((v) => !v)}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow"
          >
            {showBoard ? t.boardClose : t.boardFind}
          </button>
        )}
      </div>

      {showBoard && boardProducts.length > 0 && (
        <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto bg-black/90 p-6">
          <p className="text-lg font-semibold">{t.boardInstruction}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {boardProducts.map((p) => (
              <BoardBarcode key={p.id} barcode={p.barcode} name={p.name} price={p.sell_price} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
