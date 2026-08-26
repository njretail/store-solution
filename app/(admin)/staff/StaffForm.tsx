"use client";

import { useActionState } from "react";
import { createStaff, type StaffState } from "./actions";
import type { Store } from "@/lib/types";

const initialState: StaffState = { error: null, success: null };

export default function StaffForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState(createStaff, initialState);

  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-zinc-700">
        + 직원 계정 추가
      </summary>
      <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input
          name="email"
          type="email"
          placeholder="이메일"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <input
          name="password"
          type="text"
          placeholder="초기 비밀번호 (6자 이상)"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <input
          name="name"
          placeholder="이름 (선택)"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <select
          name="role"
          defaultValue="staff"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="staff">직원</option>
          <option value="admin">관리자</option>
        </select>
        <select
          name="store_id"
          defaultValue=""
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="">매장 미배정</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "생성 중..." : "계정 생성"}
        </button>

        {state.error && (
          <p className="col-span-full text-sm text-red-600">{state.error}</p>
        )}
        {state.success && (
          <p className="col-span-full text-sm text-green-600">{state.success}</p>
        )}
      </form>
    </details>
  );
}
