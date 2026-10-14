"use client";

import { useActionState } from "react";
import { submitAgencyRequest, type AgencyFormState } from "./actions";

const initialState: AgencyFormState = { error: null, success: null };

type Service = { value: string; description: string; points: readonly string[] };

export default function AgencyRequestForm({
  services,
  defaultName,
  defaultPhone,
  disabled,
}: {
  services: readonly Service[];
  defaultName: string;
  defaultPhone: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitAgencyRequest, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((s) => (
          <label
            key={s.value}
            className="flex cursor-pointer flex-col gap-2 rounded-xl border-2 border-zinc-200 bg-white p-5 has-[:checked]:border-[#C8075F] has-[:checked]:bg-[#C8075F]/5"
          >
            <span className="flex items-center gap-3">
              <input type="checkbox" name="services" value={s.value} className="h-5 w-5 accent-[#C8075F]" />
              <span className="text-lg font-semibold text-zinc-900">{s.value}</span>
            </span>
            <span className="text-sm text-zinc-600">{s.description}</span>
            <ul className="text-xs text-zinc-500">
              {s.points.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </label>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-600">신청자 이름</label>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-600">연락처</label>
          <input
            name="phone"
            type="tel"
            required
            defaultValue={defaultPhone}
            placeholder="010-0000-0000"
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm text-zinc-600">희망 일정 (선택)</label>
          <input
            name="schedule"
            placeholder="예: 매주 월·목 오전 / 10월 20일부터"
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm text-zinc-600">요청 내용 (선택)</label>
          <textarea
            name="message"
            rows={4}
            maxLength={1500}
            placeholder="필요한 업무, 매장 상황 등을 적어 주세요."
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}

      <button
        type="submit"
        disabled={pending || disabled}
        className="self-start rounded-lg bg-[#C8075F] px-6 py-3 text-base font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "대행 신청하기"}
      </button>
    </form>
  );
}
