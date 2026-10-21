"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KioskLang } from "@/lib/kiosk-i18n";
import { KIOSK_VOICE_STRINGS } from "@/lib/kiosk-voice-i18n";
import { CUSTOMER_VOICE_TAGS, type CustomerVoiceKind } from "@/lib/types";

// 무인매장이라 고객이 화면을 그대로 두고 떠나도 정리해 줄 직원이 없다 — 보낸 뒤에는 잠시 후,
// 입력 도중이라도 한동안 아무 조작이 없으면 키오스크 처음 화면으로 돌아간다.
const DONE_RETURN_MS = 8000;
const IDLE_RETURN_MS = 90000;
const MAX_MESSAGE = 300;

// 1단계 종류 선택 → 2단계 분류 버튼(상품 요청·불편 사항만) + 자유 입력 → 완료.
// 키오스크 터치 화면이라 타이핑 없이 분류 버튼만 눌러도 보낼 수 있게 했다.
export default function VoiceForm({ kioskId, lang }: { kioskId: string; lang: KioskLang }) {
  const t = KIOSK_VOICE_STRINGS[lang];
  const router = useRouter();
  const homeHref = `/kiosk/${kioskId}`;
  const [kind, setKind] = useState<CustomerVoiceKind | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const goHome = () => router.replace(homeHref);
    if (done) {
      const timer = setTimeout(goHome, DONE_RETURN_MS);
      return () => clearTimeout(timer);
    }
    let timer = setTimeout(goHome, IDLE_RETURN_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(goHome, IDLE_RETURN_MS);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [done, homeHref, router]);

  const tagOptions = kind === "product_request" || kind === "complaint" ? CUSTOMER_VOICE_TAGS[kind] : [];
  const canSubmit = (tags.length > 0 || message.trim().length > 0) && !pending;

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    if (!canSubmit) {
      setError(t.needInput);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/kiosk/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kiosk_id: kioskId, kind, tags, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류로 보내지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold text-green-600">{t.doneTitle}</p>
        <p className="text-sm text-zinc-500">{t.doneBody}</p>
        <a href={homeHref} className="mt-2 rounded bg-[#C8075F] px-5 py-3 text-base font-medium text-white">
          {t.home}
        </a>
      </div>
    );
  }

  // 1단계: 의견 종류 선택
  if (!kind) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-base font-semibold">{t.kindTitle}</p>
        {(["product_request", "complaint", "compliment", "other"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="rounded-xl border-2 border-zinc-200 px-4 py-4 text-left hover:border-[#C8075F] active:bg-[#C8075F]/5"
          >
            <p className="text-base font-semibold text-zinc-900">{t.kinds[k].title}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.kinds[k].desc}</p>
          </button>
        ))}
        <p className="mt-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">{t.anonymousNote}</p>
        <a href={homeHref} className="text-center text-sm text-zinc-500 underline">
          {t.home}
        </a>
      </div>
    );
  }

  // 2단계: 분류 버튼 + 자세한 내용
  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg bg-[#C8075F]/5 px-3 py-2 text-sm">
        <span className="font-medium text-[#C8075F]">{t.kinds[kind].title}</span>
        <button
          type="button"
          onClick={() => {
            setKind(null);
            setTags([]);
            setError(null);
          }}
          className="text-xs text-zinc-500 underline"
        >
          {t.back}
        </button>
      </div>

      {tagOptions.length > 0 && (kind === "product_request" || kind === "complaint") && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-800">{t.tagTitle[kind]}</p>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={on}
                  className={`rounded-full border-2 px-4 py-2 text-base ${
                    on ? "border-[#C8075F] bg-[#C8075F] text-white" : "border-zinc-200 text-zinc-700"
                  }`}
                >
                  {t.tags[tag]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">
          {t.messageLabel} {tagOptions.length > 0 && <span className="text-zinc-400">{t.messageOptional}</span>}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          placeholder={t.messagePlaceholder[kind]}
          rows={4}
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
        <p className="self-end text-xs text-zinc-400">
          {message.length}/{MAX_MESSAGE}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[#C8075F] px-4 py-3 text-base font-medium text-white hover:bg-[#a80650] disabled:opacity-40"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
