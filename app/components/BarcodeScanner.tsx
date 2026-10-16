"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

// 카메라를 못 여는 이유별 안내 — 예전엔 어떤 이유든 같은 문구라 원인을 알 수 없었다.
// (실제로 매장 PC에 웹캠이 없어 "카메라를 사용할 수 없습니다"만 뜨던 경우가 있었음)
function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? (e as { name: string }).name : "";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "보안 연결(https)이 아니라 카메라를 쓸 수 없어요. https 주소로 접속해 주세요.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "카메라 권한이 막혀 있어요. 주소창 왼쪽의 자물쇠(사이트 설정)에서 카메라를 '허용'으로 바꾼 뒤 다시 시도해 주세요.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "이 기기에 카메라가 없어요. 휴대폰으로 접속해서 찍거나, USB 바코드 리더기로 아래 입력칸에 찍어 주세요.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "다른 프로그램(화상회의 등)이 카메라를 쓰고 있어요. 그 프로그램을 닫고 다시 시도해 주세요.";
  }
  return "카메라를 열지 못했어요. 다시 시도하거나 아래에 바코드를 직접 입력해 주세요.";
}

export default function BarcodeScanner({
  onDetect,
}: {
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);
  // "다시 시도"를 누르면 값이 바뀌어 카메라 열기를 처음부터 다시 한다.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // 카메라는 마운트(또는 다시 시도) 때만 열고, 이후 onDetect 변경으로 재시작되지 않도록
  // ref를 통해 최신 콜백을 참조한다.
  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (!result || cancelled) return;
        const code = result.getText();
        const now = Date.now();
        if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 1500) {
          return;
        }
        lastCodeRef.current = { code, at: now };
        onDetectRef.current(code);
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(cameraErrorMessage(e));
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [attempt]);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black">
      {error ? (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="text-sm text-amber-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
            className="rounded bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          muted
          playsInline
        />
      )}
    </div>
  );
}
