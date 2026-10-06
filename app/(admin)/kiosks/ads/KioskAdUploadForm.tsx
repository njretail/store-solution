"use client";

import { useActionState } from "react";
import { uploadKioskAd, type KioskAdState } from "./actions";
import type { Kiosk } from "@/lib/types";

const initialState: KioskAdState = { error: null, success: null };

export default function KioskAdUploadForm({ kiosks }: { kiosks: Kiosk[] }) {
  const [state, formAction, pending] = useActionState(uploadKioskAd, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">노출 대상</label>
        <select name="kiosk_id" className="rounded border border-zinc-300 px-2 py-1.5 text-sm">
          <option value="">전체 키오스크 공통</option>
          {kiosks.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}만
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">
          이미지 또는 영상 (키오스크 화면 크기에 맞춰 준비, 영상은 25MB 이하로 짧게)
        </label>
        <input
          name="image"
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
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
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
