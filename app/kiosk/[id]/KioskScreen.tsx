"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { Kiosk, KioskAd, KioskAnnouncement, KioskStatus, Product, Store } from "@/lib/types";

const AD_INTERVAL_MS = 7000;
const ANNOUNCEMENT_INTERVAL_MS = 20000;
const POLL_INTERVAL_MS = 20000;

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastCommandAtRef = useRef<string | null>(kiosk.remote_command_at);

  // 광고 슬라이드쇼
  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setAdIndex((i) => (i + 1) % ads.length), AD_INTERVAL_MS);
    return () => clearInterval(t);
  }, [ads.length]);

  // 안내멘트 순환 재생 — 화면을 터치해서 시작한 뒤부터만(브라우저 자동재생 제한 때문).
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
    const t = setInterval(play, ANNOUNCEMENT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [started, announcements]);

  // 원격 관리 — 20초마다 상태를 확인해서, 상태가 바뀌면 화면에 반영하고
  // 새로고침 명령(remote_command_at 변경)이 오면 새로고침한다.
  useEffect(() => {
    const t = setInterval(async () => {
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
    return () => clearInterval(t);
  }, [kiosk.id]);

  if (status === "maintenance" || status === "offline") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-900 text-white">
        <p className="text-3xl font-semibold">
          {status === "maintenance" ? "점검 중입니다" : "일시 이용 불가"}
        </p>
        <p className="text-zinc-400">잠시 후 다시 이용해 주세요.</p>
      </div>
    );
  }

  if (!started) {
    return (
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
        <p className="text-xl">화면을 터치하여 시작하세요</p>
      </button>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 text-white">
      <audio ref={audioRef} />

      {kiosk.banner_message && (
        <div className="bg-[#C8075F] px-6 py-2 text-center text-lg font-medium">
          {kiosk.banner_message}
        </div>
      )}

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {ads.length > 0 ? (
          ads.map((ad, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={ad.id}
              src={ad.image_url}
              alt="광고"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                i === adIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))
        ) : (
          <p className="text-2xl text-zinc-500">{store?.name ?? "무인매장"}</p>
        )}
      </div>

      {kiosk.notice_message && (
        <div className="bg-zinc-900 px-6 py-3 text-center text-sm text-zinc-300">
          {kiosk.notice_message}
        </div>
      )}

      <a
        href={`/kiosk/${kiosk.id}/change-request`}
        className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow"
      >
        거스름돈 부족 · 계좌로 받기
      </a>

      {boardProducts.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowBoard((v) => !v)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow"
          >
            바코드 없는 상품 {showBoard ? "닫기" : "찾기"}
          </button>
          {showBoard && (
            <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto bg-black/90 p-6">
              <p className="text-lg font-semibold">바코드가 없는 상품은 아래 바코드를 스캔해 주세요</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {boardProducts.map((p) => (
                  <BoardBarcode key={p.id} barcode={p.barcode} name={p.name} price={p.sell_price} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
