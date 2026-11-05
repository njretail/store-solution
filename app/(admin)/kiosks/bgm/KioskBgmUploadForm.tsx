"use client";

import { useActionState } from "react";
import { uploadKioskBgm, type KioskBgmState } from "./actions";
import type { Kiosk } from "@/lib/types";

const initialState: KioskBgmState = { error: null, success: null };

export default function KioskBgmUploadForm({ kiosks }: { kiosks: Kiosk[] }) {
  const [state, formAction, pending] = useActionState(uploadKioskBgm, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-400">
        가사 없는 반주곡을 올려 주세요 — 키오스크에서 광고·안내멘트가 함께 나오기 때문에 가사가
        있으면 멘트가 잘 안 들립니다. 매장에서 틀 수 있는 저작권이 해결된 음원(로열티 프리 등)만
        사용하세요. 안내멘트가 나오는 동안에는 키오스크가 BGM 음량을 자동으로 줄입니다.
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
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">곡 이름 (선택, 비우면 파일 이름)</label>
          <input
            name="title"
            placeholder="예: 신나는 오후 반주"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">음악 파일 (mp3 권장, 25MB 이하)</label>
          <input
            name="audio"
            type="file"
            accept="audio/*"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "업로드 중..." : "등록"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
