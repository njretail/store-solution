"use client";

import { useEffect } from "react";
import { makeKoreanUtterance, warmUpVoices } from "@/lib/kiosk-voice";

// 등록한 멘트를 키오스크와 같은 방식(업로드 오디오 우선, 없으면 기기 음성)으로 들어 본다.
// 휴대폰은 누르는 순간 바로 재생해야 소리가 나므로 클릭 핸들러 안에서 곧장 재생한다.
export default function PreviewAnnouncementButton({
  message,
  audioUrl,
}: {
  message: string;
  audioUrl: string | null;
}) {
  useEffect(() => warmUpVoices(), []);

  function play() {
    if (audioUrl) {
      new Audio(audioUrl).play().catch(() => {});
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(makeKoreanUtterance(message));
  }

  return (
    <button
      type="button"
      onClick={play}
      className="rounded border border-[#C8075F] px-2 py-1 text-xs text-[#C8075F] hover:bg-[#fdf2f7]"
    >
      ▶ 미리 듣기
    </button>
  );
}
