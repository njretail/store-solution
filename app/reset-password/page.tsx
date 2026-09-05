"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/app/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    // 이메일의 재설정 링크를 타고 들어오면 Supabase가 임시 세션을 이미 심어둔 상태다.
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setError("변경에 실패했습니다. 링크가 만료되었을 수 있어요 — 비밀번호 찾기를 다시 시도해주세요.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col gap-4">
          <Logo className="text-xl" />
          <h1 className="text-xl font-semibold text-zinc-900">새 비밀번호 설정</h1>
        </div>

        {done ? (
          <p className="text-sm text-zinc-700">
            비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다...
          </p>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-zinc-700">새 비밀번호</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
            />

            <label className="mb-1 block text-sm font-medium text-zinc-700">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#C8075F] focus:outline-none"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-[#C8075F] px-3 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
            >
              {pending ? "변경 중..." : "비밀번호 변경"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
