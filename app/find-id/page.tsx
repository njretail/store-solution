"use client";

import { useActionState } from "react";
import Link from "next/link";
import Logo from "@/app/components/Logo";
import { findId, type FindIdState } from "./actions";

const initialState: FindIdState = { result: null, error: null };

export default function FindIdPage() {
  const [state, formAction, pending] = useActionState(findId, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col gap-4">
          <Logo className="text-xl" />
          <h1 className="text-xl font-semibold text-zinc-900">아이디 찾기</h1>
          <p className="text-sm text-zinc-500">
            가입 시 등록한 이름과 전화번호로 이메일을 찾을 수 있어요.
          </p>
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-700">이름</label>
        <input
          name="name"
          required
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-700">전화번호</label>
        <input
          name="phone"
          required
          placeholder="01012345678"
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
        />

        {state.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}
        {state.result && (
          <p className="mb-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            찾은 이메일: <span className="font-medium">{state.result}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mb-4 w-full rounded-md bg-[#C8075F] px-3 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "조회 중..." : "아이디 찾기"}
        </button>

        <Link href="/login" className="block text-center text-sm text-zinc-500 hover:text-zinc-700">
          로그인으로 돌아가기
        </Link>
      </form>
    </div>
  );
}
