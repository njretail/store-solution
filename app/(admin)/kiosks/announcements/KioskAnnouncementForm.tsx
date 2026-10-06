"use client";

import { useActionState } from "react";
import { createKioskAnnouncement, type KioskAnnouncementState } from "./actions";
import type { Kiosk } from "@/lib/types";

const initialState: KioskAnnouncementState = { error: null, success: null };

export default function KioskAnnouncementForm({ kiosks }: { kiosks: Kiosk[] }) {
  const [state, formAction, pending] = useActionState(createKioskAnnouncement, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-400">
        예: “결제는 이 화면에서 진행해 주세요”, “도난 방지를 위해 전 구역이 녹화되고
        있습니다”, “봉투는 별도 구매입니다”. 오디오 파일을 올리면 그 소리가 재생되고,
        안 올리면 문구를 브라우저 음성(TTS)으로 읽어줍니다.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">적용 대상</label>
          <select name="kiosk_id" className="rounded border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">전체 키오스크 공통</option>
            {kiosks.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}만
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">안내멘트 문구</label>
          <input
            name="message"
            required
            placeholder="예: 결제는 이 화면에서 진행해 주세요"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">오디오 파일 (선택, 없으면 TTS로 읽음)</label>
          <input name="audio" type="file" accept="audio/*" className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "등록 중..." : "등록"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
