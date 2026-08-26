"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

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

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // 마운트 시 1회만 카메라를 열고, 이후 onDetect 변경으로 재시작되지 않도록
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
      .catch(() => {
        setError("카메라를 사용할 수 없습니다. 아래에 바코드를 직접 입력하세요.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black">
      {error ? (
        <p className="p-4 text-sm text-amber-400">{error}</p>
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
