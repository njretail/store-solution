"use client";

import { useActionState, useEffect, useState } from "react";
import Logo from "@/app/components/Logo";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };
const SAVED_EMAIL_KEY = "store_solution_saved_email";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);

  // 저장된 아이디가 있으면 마운트 후(클라이언트에서만) 불러와 채워준다.
  // localStorage는 서버에 없는 브라우저 전용 저장소라 렌더 중 계산으로 대체할 수 없다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        action={formAction}
        onSubmit={() => {
          if (rememberEmail) {
            localStorage.setItem(SAVED_EMAIL_KEY, email);
          } else {
            localStorage.removeItem(SAVED_EMAIL_KEY);
          }
        }}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col gap-4">
          <Logo className="text-xl" />
          <h1 className="text-xl font-semibold text-zinc-900">
            무인편의점 관리자 로그인
          </h1>
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-700">
          이메일
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-700">
          비밀번호
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mb-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
        />

        <label className="mb-4 flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(e) => setRememberEmail(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          아이디 저장
        </label>

        {state.error && (
          <p className="mb-4 text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-[#C8075F] px-3 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
