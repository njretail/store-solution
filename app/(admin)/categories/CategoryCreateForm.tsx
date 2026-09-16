"use client";

import { useActionState, useState } from "react";
import { createCategory, type CategoryState } from "./actions";

const initialState: CategoryState = { error: null, success: null };

export default function CategoryCreateForm() {
  const [name, setName] = useState("");
  const [state, formAction, pending] = useActionState(createCategory, initialState);

  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) setName("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 카테고리 이름"
          className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "추가 중..." : "카테고리 추가"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
