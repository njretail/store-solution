"use client";

import { useActionState, useState } from "react";
import { createAnnouncement, type AnnouncementState } from "./actions";

const initialState: AnnouncementState = { error: null, success: null };

export default function AnnouncementForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState(createAnnouncement, initialState);

  const [handledSuccess, setHandledSuccess] = useState(state.success);
  if (state.success !== handledSuccess) {
    setHandledSuccess(state.success);
    if (state.success) {
      setTitle("");
      setBody("");
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
      />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="내용"
        rows={3}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending || !title.trim() || !body.trim()}
        className="self-start rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "등록 중..." : "공지 등록"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
