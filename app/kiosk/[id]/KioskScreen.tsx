"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import JsBarcode from "jsbarcode";
import type { Kiosk, KioskAd, KioskAnnouncement, KioskStatus, Product, Store } from "@/lib/types";
import { KIOSK_LANGS, KIOSK_LANG_LABELS, KIOSK_STRINGS, type KioskLang } from "@/lib/kiosk-i18n";
import { KIOSK_VOICE_STRINGS } from "@/lib/kiosk-voice-i18n";

const AD_INTERVAL_MS = 7000;
const ANNOUNCEMENT_INTERVAL_MS = 20000;
const POLL_INTERVAL_MS = 20000;
const BOARD_IDLE_MS = 60000;
const LANG_STORAGE_KEY = "kiosk-lang";
const LARGE_TEXT_STORAGE_KEY = "kiosk-large-text";
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

// 화면 크기 단위 — 포스 세로 모니터(1080×1920) 기준 1u = 20px.
// 모니터 해상도나 Windows 배율이 달라도 9:16 화면 안에서 같은 비율로 보이도록
// 뷰포트 크기에서 계산한다(가로 화면에서 열면 가운데에 세로 화면으로 보인다).
// --t는 글자 전용 단위로, 큰글씨를 켜면 글자만 1.2배가 되고 배치는 그대로다.
function screenVars(largeText: boolean): CSSProperties {
  return {
    "--u": "min(100vw / 54, 100dvh / 96)",
    "--t": largeText ? "calc(var(--u) * 1.2)" : "var(--u)",
  } as CSSProperties;
}

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일 · ${hh}:${mm}`;
}

const ICON_SEARCH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-full w-full">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const ICON_COIN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-full w-full">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8m0 8v1.5" />
  </svg>
);
const ICON_CHAT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-full w-full">
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
  </svg>
);
const ICON_TOOL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-full w-full">
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
  </svg>
);

function LangSwitcher({ lang, onChange }: { lang: KioskLang; onChange: (l: KioskLang) => void }) {
  return (
    <div className="flex gap-[calc(var(--u)*0.4)] rounded-full bg-zinc-100/95 p-[calc(var(--u)*0.3)]">
      {KIOSK_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`h-[calc(var(--u)*3.2)] min-w-[calc(var(--u)*5.6)] rounded-full px-[calc(var(--u)*1)] text-[calc(var(--u)*1.2)] font-bold ${
            l === lang ? "bg-[#C8075F] text-white" : "text-zinc-600"
          }`}
        >
          {KIOSK_LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

function AdSlides({ ads, adIndex }: { ads: KioskAd[]; adIndex: number }) {
  return (
    <>
      {ads.map((ad, i) => {
        const cls = `absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          i === adIndex ? "opacity-100" : "opacity-0"
        }`;
        return VIDEO_EXT.test(ad.image_url) ? (
          <video key={ad.id} src={ad.image_url} autoPlay muted loop playsInline className={cls} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={ad.id} src={ad.image_url} alt="광고" className={cls} />
        );
      })}
    </>
  );
}

function ActionButton({
  icon,
  title,
  desc,
  primary,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const cls = `flex items-center gap-[calc(var(--u)*1.4)] rounded-[calc(var(--u)*1.4)] border-2 px-[calc(var(--u)*1.8)] text-left active:scale-[0.98] ${
    primary
      ? "min-h-[calc(var(--u)*10)] border-[#C8075F] bg-[#C8075F] text-white"
      : "min-h-[calc(var(--u)*7.5)] border-zinc-200 bg-white text-zinc-900 shadow-sm"
  }`;
  const body = (
    <>
      <span
        className={`flex flex-none items-center justify-center rounded-[calc(var(--u)*1.2)] ${
          primary
            ? "h-[calc(var(--u)*6)] w-[calc(var(--u)*6)] bg-white/20 p-[calc(var(--u)*1.3)] text-white"
            : "h-[calc(var(--u)*4.8)] w-[calc(var(--u)*4.8)] bg-[#fdf2f7] p-[calc(var(--u)*1)] text-[#C8075F]"
        }`}
      >
        {icon}
      </span>
      <span>
        <b
          className={`block font-extrabold leading-tight ${
            primary ? "text-[calc(var(--t)*2.2)]" : "text-[calc(var(--t)*1.6)]"
          }`}
        >
          {title}
        </b>
        <small
          className={`mt-[calc(var(--u)*0.3)] block leading-snug ${
            primary ? "text-[calc(var(--t)*1.2)] text-white/85" : "text-[calc(var(--t)*1.1)] text-zinc-500"
          }`}
        >
          {desc}
        </small>
      </span>
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function BoardBarcode({ barcode, name, price }: { barcode: string; name: string; price: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, barcode, { format: "CODE128", height: 110, width: 2.6, displayValue: false, margin: 0 });
      ref.current.setAttribute("preserveAspectRatio", "xMidYMid meet");
    } catch {
      // barcode 값이 CODE128로 인코딩 안 되면 그림 없이 텍스트만 보여준다.
    }
  }, [barcode]);

  return (
    <div className="flex flex-col items-center gap-[calc(var(--u)*0.3)] rounded-[calc(var(--u)*1.2)] border-2 border-zinc-200 bg-white px-[calc(var(--u)*1.2)] pb-[calc(var(--u)*1)] pt-[calc(var(--u)*1.4)] text-zinc-900">
      <p className="text-center text-[calc(var(--t)*1.6)] font-extrabold">{name}</p>
      <p className="text-[calc(var(--t)*1.5)] font-extrabold text-[#C8075F]">{price.toLocaleString()}원</p>
      <svg ref={ref} className="mt-[calc(var(--u)*0.4)] h-[calc(var(--u)*6.5)] w-full" />
      <p className="font-mono text-[calc(var(--t)*1)] tracking-wider text-zinc-400">{barcode}</p>
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
  const [now, setNow] = useState<Date | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastCommandAtRef = useRef<string | null>(kiosk.remote_command_at);
  const t = KIOSK_STRINGS[lang];
  const storeName = store?.name ?? "무인매장";

  // 언어·큰글씨 설정은 이 키오스크 기기에서 계속 쓰는 값이라 localStorage에 남겨서
  // 다음에 화면을 열었을 때도(새로고침/재부팅 후) 유지되게 한다. 서버 렌더링 시점엔
  // localStorage가 없어서 항상 기본값(ko/보통크기)으로 그려지고, 마운트 후 이 effect가
  // 저장된 값으로 갱신한다 — useState 지연 초기화로 바꾸면 SSR 결과와 클라이언트 첫
  // 렌더가 달라져(hydration mismatch) 오히려 더 큰 문제가 생긴다.
  // 시계도 같은 이유로 마운트 후에만 그린다(서버와 기기의 시각이 달라 mismatch 발생).
  /* eslint-disable react-hooks/set-state-in-effect -- SSR엔 localStorage가 없어
     기본값으로 그려지고, 마운트 후 저장된 값으로 갱신하는 의도된 패턴. useState
     지연 초기화로 바꾸면 서버 렌더와 클라이언트 첫 렌더가 달라져(hydration
     mismatch) 오히려 더 큰 문제가 생긴다. */
  useEffect(() => {
    setLang(loadStored(LANG_STORAGE_KEY, "ko") as KioskLang);
    setLargeText(loadStored(LARGE_TEXT_STORAGE_KEY, "0") === "1");
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
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

  // 바코드 없는 상품 화면은 손님이 닫지 않고 떠나도 다음 손님에게 그대로 남지 않도록
  // 60초 동안 터치가 없으면 자동으로 닫는다.
  useEffect(() => {
    if (!showBoard) return;
    let timer = setTimeout(() => setShowBoard(false), BOARD_IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setShowBoard(false), BOARD_IDLE_MS);
    };
    window.addEventListener("pointerdown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
    };
  }, [showBoard]);

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
        // hb=screen — 이 폴링이 곧 화면의 생존 신호(5분 넘게 없으면 "응답 없음" 알림).
        const res = await fetch(`/api/kiosk/${kiosk.id}/state?hb=screen`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: KioskStatus;
          remote_command: string | null;
          remote_command_at: string | null;
        };
        setStatus(data.status);
        if (data.remote_command_at && data.remote_command_at !== lastCommandAtRef.current) {
          lastCommandAtRef.current = data.remote_command_at;
          // 상태 점검은 PC의 kiosk-agent가 처리하는 명령이라 화면은 그대로 둔다.
          if (data.remote_command === "health_check") return;
          // "다시 로그인" — 화면에 남은 세션·설정(언어, 큰글씨 등)을 비우고 처음 상태로 다시 연다.
          // (PC의 브라우저 프로필 초기화·재실행은 kiosk-agent가 같은 명령으로 따로 처리)
          if (data.remote_command === "relogin") {
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch {
              // 저장소 접근이 막혀 있어도 새로고침은 진행
            }
          }
          location.reload();
        }
      } catch {
        // 네트워크 일시 오류는 다음 폴링에서 다시 시도
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [kiosk.id]);

  let content: ReactNode;

  if (status === "maintenance" || status === "offline") {
    // 손님이 언어를 고르기 전일 수 있어서, 선택된 언어를 크게 + 나머지 언어를 작게 함께 보여준다.
    const titleKey = status === "maintenance" ? "maintenanceTitle" : "offlineTitle";
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-[calc(var(--u)*1)] bg-zinc-900 text-center text-white">
        <div className="mb-[calc(var(--u)*1)] flex h-[calc(var(--u)*8)] w-[calc(var(--u)*8)] items-center justify-center rounded-full bg-zinc-800 p-[calc(var(--u)*1.8)] text-amber-400">
          {ICON_TOOL}
        </div>
        <p className="text-[calc(var(--t)*3.2)] font-extrabold">{t[titleKey]}</p>
        <p className="text-[calc(var(--t)*1.6)] text-zinc-400">{t.maintenanceBody}</p>
        <div className="mt-[calc(var(--u)*2)] flex flex-col gap-[calc(var(--u)*0.5)] text-[calc(var(--t)*1.3)] text-zinc-500">
          {KIOSK_LANGS.filter((l) => l !== lang).map((l) => (
            <p key={l}>
              {KIOSK_STRINGS[l][titleKey]} · {KIOSK_STRINGS[l].maintenanceBody}
            </p>
          ))}
        </div>
      </div>
    );
  } else if (!started) {
    content = (
      <div className="relative flex-1 bg-black text-white">
        <button
          type="button"
          onClick={() => {
            // 첫 터치에서 TTS/오디오 자동재생 제한을 풀어둔다.
            if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
            audioRef.current?.play().catch(() => {});
            setStarted(true);
          }}
          className="absolute inset-0 h-full w-full"
        >
          {ads.length > 0 ? <AdSlides ads={ads} adIndex={adIndex} /> : <div className="absolute inset-0 bg-[#C8075F]" />}
          <div className="absolute inset-0 bg-linear-to-b from-black/25 via-transparent via-30% to-black/75" />
          <div className="absolute inset-x-0 bottom-[calc(var(--u)*6)] flex flex-col items-center gap-[calc(var(--u)*1.4)]">
            <span className="relative">
              {/* 바깥 테두리만 퍼지게 해서 글자는 흐려지지 않고 시선만 끈다. */}
              <span className="absolute inset-0 animate-ping rounded-full bg-[#C8075F]/50 [animation-duration:2s]" />
              <span className="relative block rounded-full bg-[#C8075F] px-[calc(var(--u)*4)] py-[calc(var(--u)*1.8)] text-[calc(var(--t)*2.4)] font-extrabold">
                {t.tapToStart}
              </span>
            </span>
            <span className="px-[calc(var(--u)*2)] text-[calc(var(--t)*1.3)] text-white/85">
              {KIOSK_LANGS.filter((l) => l !== lang)
                .map((l) => KIOSK_STRINGS[l].tapToStart)
                .join("  ·  ")}
            </span>
          </div>
        </button>
        <div className="pointer-events-none absolute inset-x-[calc(var(--u)*2)] top-[calc(var(--u)*2)] flex items-center justify-between">
          <p className="text-[calc(var(--t)*2)] font-extrabold drop-shadow">{storeName}</p>
          <div className="pointer-events-auto">
            <LangSwitcher lang={lang} onChange={changeLang} />
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <>
        <header className="flex h-[calc(var(--u)*7)] flex-none items-center justify-between gap-[calc(var(--u)*1)] border-b border-zinc-200 bg-white px-[calc(var(--u)*2)]">
          <div className="min-w-0">
            {/* 헤더(매장명·시계·언어)는 큰글씨에서도 크기를 고정해 한 줄에 들어가게 한다. */}
            <p className="truncate text-[calc(var(--u)*2.2)] font-extrabold leading-tight tracking-tight">{storeName}</p>
            {now && <p className="mt-[calc(var(--u)*0.2)] text-[calc(var(--u)*1.2)] font-medium text-zinc-500">{formatClock(now)}</p>}
          </div>
          <LangSwitcher lang={lang} onChange={changeLang} />
        </header>

        {kiosk.banner_message && (
          <div className="flex h-[calc(var(--u)*4.4)] flex-none items-center justify-center gap-[calc(var(--u)*0.8)] bg-[#C8075F] px-[calc(var(--u)*2)] text-white">
            <span className="flex-none rounded-full bg-white/20 px-[calc(var(--u)*0.8)] py-[calc(var(--u)*0.3)] text-[calc(var(--t)*1)] font-bold">
              {t.bannerTag}
            </span>
            <span className="truncate text-[calc(var(--t)*1.6)] font-bold">{kiosk.banner_message}</span>
          </div>
        )}

        <div className="relative h-[calc(var(--u)*43)] flex-none overflow-hidden bg-black">
          {ads.length > 0 ? (
            <>
              <AdSlides ads={ads} adIndex={adIndex} />
              {ads.length > 1 && (
                <div className="absolute inset-x-0 bottom-[calc(var(--u)*1.4)] flex justify-center gap-[calc(var(--u)*0.6)]">
                  {ads.map((ad, i) => (
                    <i
                      key={ad.id}
                      className={`h-[calc(var(--u)*0.7)] rounded-full ${
                        i === adIndex ? "w-[calc(var(--u)*2)] bg-white" : "w-[calc(var(--u)*0.7)] bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-800 text-[calc(var(--t)*2.4)] font-bold text-zinc-400">
              {storeName}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[calc(var(--u)*1.2)] bg-zinc-50 px-[calc(var(--u)*2)] py-[calc(var(--u)*1.8)]">
          {boardProducts.length > 0 && (
            <ActionButton
              primary
              icon={ICON_SEARCH}
              title={t.boardFind}
              desc={t.boardFindDesc}
              onClick={() => setShowBoard(true)}
            />
          )}
          <ActionButton
            icon={ICON_COIN}
            title={t.changeRequestButton}
            desc={t.changeRequestDesc}
            href={`/kiosk/${kiosk.id}/change-request?lang=${lang}`}
          />
          <ActionButton
            icon={ICON_CHAT}
            title={KIOSK_VOICE_STRINGS[lang].button}
            desc={t.voiceDesc}
            href={`/kiosk/${kiosk.id}/voice?lang=${lang}`}
          />
          <button
            type="button"
            onClick={toggleLargeText}
            aria-pressed={largeText}
            className={`mt-auto flex h-[calc(var(--u)*4.8)] flex-none items-center justify-center gap-[calc(var(--u)*0.6)] rounded-[calc(var(--u)*1.2)] border-2 text-[calc(var(--t)*1.3)] font-bold ${
              largeText ? "border-[#C8075F] bg-[#fdf2f7] text-[#C8075F]" : "border-zinc-200 bg-white text-zinc-900"
            }`}
          >
            <span className="text-[1.3em]">
              가{!largeText && <sup>+</sup>}
            </span>
            {t.largeText} {largeText ? "ON" : "OFF"}
          </button>
        </div>

        {kiosk.notice_message && (
          <footer className="flex h-[calc(var(--u)*4.4)] flex-none items-center justify-center bg-zinc-900 px-[calc(var(--u)*2)] text-center text-[calc(var(--t)*1.3)] text-zinc-300">
            <span className="truncate">{kiosk.notice_message}</span>
          </footer>
        )}

        {/* 닫기 버튼을 시트 안에 둬서 상품 목록이 버튼을 가리지 않게 한다. */}
        {showBoard && boardProducts.length > 0 && (
          <div className="absolute inset-0 z-20 flex flex-col bg-zinc-50">
            <div className="flex h-[calc(var(--u)*8)] flex-none items-center justify-between gap-[calc(var(--u)*1.2)] border-b border-zinc-200 bg-white px-[calc(var(--u)*2)]">
              <div>
                <p className="text-[calc(var(--t)*2.2)] font-extrabold">{t.boardFind}</p>
                <p className="mt-[calc(var(--u)*0.2)] text-[calc(var(--t)*1.2)] text-zinc-500">{t.boardInstruction}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBoard(false)}
                className="flex h-[calc(var(--u)*4.8)] flex-none items-center gap-[calc(var(--u)*0.6)] rounded-[calc(var(--u)*1.2)] bg-zinc-900 px-[calc(var(--u)*2)] text-[calc(var(--t)*1.5)] font-extrabold text-white"
              >
                ✕ {t.boardClose}
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 content-start gap-[calc(var(--u)*1.2)] overflow-y-auto px-[calc(var(--u)*2)] py-[calc(var(--u)*1.6)]">
              {boardProducts.map((p) => (
                <BoardBarcode key={p.id} barcode={p.barcode} name={p.name} price={p.sell_price} />
              ))}
            </div>
            <p className="flex-none border-t border-zinc-200 bg-white p-[calc(var(--u)*0.8)] text-center text-[calc(var(--t)*1.1)] text-zinc-500">
              {t.boardIdleNote}
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black" style={screenVars(largeText)}>
      <audio ref={audioRef} />
      <div className="relative flex h-[calc(var(--u)*96)] w-[calc(var(--u)*54)] flex-col overflow-hidden break-keep bg-zinc-50 text-zinc-900">
        {content}
      </div>
    </div>
  );
}
