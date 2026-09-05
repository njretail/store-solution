"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/app/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setPending(false);
    if (error) {
      setError("메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col gap-4">
          <Logo className="text-xl" />
          <h1 className="text-xl font-semibold text-zinc-900">비밀번호 찾기</h1>
          <p className="text-sm text-zinc-500">
            가입한 이메일로 비밀번호 재설정 링크를 보내드려요.
          </p>
        </div>

        {sent ? (
          <p className="mb-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {email} 로 재설정 메일을 보냈어요. 메일함(스팸함 포함)을 확인해주세요.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-zinc-700">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mb-4 w-full rounded-md bg-[#C8075F] px-3 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
            >
              {pending ? "전송 중..." : "재설정 메일 보내기"}
            </button>
          </>
        )}

        <Link href="/login" className="block text-center text-sm text-zinc-500 hover:text-zinc-700">
          로그인으로 돌아가기
        </Link>
      </form>
    </div>
  );
}
