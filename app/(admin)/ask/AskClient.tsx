"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { askQuestion } from "./actions";
import type { AnswerTable } from "@/lib/sales-assistant";

type Turn = {
  question: string;
  answer: string | null;
  tables: AnswerTable[];
  error: string | null;
};

const EXAMPLES = [
  "7월 한 달 동안 가장 많이 팔린 품목 알려줘",
  "지난주 매출을 그 전주랑 비교해줘",
  "이번 달 카테고리별 매출 비중은?",
  "최근 30일 요일별·시간대별로 언제 제일 잘 팔려?",
];

// 브라우저 음성 인식(Web Speech API) — 크롬/엣지/사파리에서 지원, 타입은 TS 기본 lib에 없어서 최소한만 선언.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

function formatCell(value: string | number, column: string): string {
  if (typeof value !== "number") return value;
  if (column === "순위") return String(value);
  return value.toLocaleString();
}

function ResultTable({ table }: { table: AnswerTable }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-700">{table.title}</h3>
        {table.link && (
          <Link href={table.link} className="text-xs text-[#C8075F] hover:underline">
            상품통계에서 자세히 보기 →
          </Link>
        )}
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              {table.columns.map((c) => (
                <th key={c} className="px-3 py-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-100">
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 py-2 ${typeof cell === "number" ? "text-right tabular-nums" : ""}`}>
                    {formatCell(cell, table.columns[j])}
                  </td>
                ))}
              </tr>
            ))}
            {table.rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length} className="px-3 py-6 text-center text-zinc-400">
                  해당 기간 판매 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AskClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  // 서버 렌더링 때는 false, 브라우저에서는 실제 지원 여부 — hydration 불일치 없이 판별.
  const micSupported = useSyncExternalStore(
    noopSubscribe,
    () => getSpeechRecognition() !== null,
    () => false
  );
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  function submit(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    recognitionRef.current?.stop();

    const previous = turns
      .filter((t) => t.answer)
      .map((t) => ({ question: t.question, answer: t.answer as string }));
    const index = turns.length;
    setTurns((prev) => [...prev, { question: q, answer: null, tables: [], error: null }]);
    setInput("");

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof askQuestion>>;
      try {
        result = await askQuestion(q, previous);
      } catch {
        result = { ok: false, error: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };
      }
      setTurns((prev) =>
        prev.map((t, i) =>
          i !== index
            ? t
            : result.ok
              ? { ...t, answer: result.answer, tables: result.tables }
              : { ...t, error: result.error }
        )
      );
    });
  }

  function toggleMic() {
    setMicError(null);
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(finalText || interim);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicError("마이크 권한이 꺼져 있어요. 브라우저 주소창 왼쪽에서 마이크를 허용해 주세요.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setMicError("음성을 인식하지 못했어요. 다시 시도해 주세요.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // 말을 마치면 바로 질문을 보낸다(입력창에 고칠 내용이 있으면 마이크를 다시 끄고 수정 가능).
      if (finalText.trim()) submit(finalText);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-col gap-6">
      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">이렇게 물어보세요</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => submit(ex)}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-[#C8075F] hover:text-[#C8075F]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((t, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="self-end rounded-2xl rounded-br-sm bg-[#C8075F] px-4 py-2 text-sm text-white">
            {t.question}
          </div>
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-4">
            {t.error ? (
              <p className="text-sm text-red-600">{t.error}</p>
            ) : t.answer === null ? (
              <p className="animate-pulse text-sm text-zinc-400">매출 데이터를 조회하고 있어요...</p>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800">{t.answer}</p>
                {t.tables.map((table, j) => (
                  <ResultTable key={j} table={table} />
                ))}
              </>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-4 flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-2 shadow-sm"
      >
        <div className="flex items-center gap-2">
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={pending}
              aria-label={listening ? "음성 입력 중지" : "음성으로 질문하기"}
              title={listening ? "음성 입력 중지" : "음성으로 질문하기"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
                listening ? "animate-pulse bg-[#C8075F] text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "듣고 있어요... 말씀하세요" : "예: 7월 한 달 가장 많이 팔린 품목 알려줘"}
            maxLength={500}
            className="min-w-0 flex-1 px-2 py-2 text-base outline-none"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="shrink-0 rounded-lg bg-[#C8075F] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "조회 중..." : "질문"}
          </button>
        </div>
        {micError && <p className="px-2 text-xs text-red-600">{micError}</p>}
      </form>
    </div>
  );
}
