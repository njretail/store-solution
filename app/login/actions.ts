"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력하세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "로그인에 실패했습니다. 이메일/비밀번호를 확인하세요." };
  }

  // admin은 홈(매출 요약)으로, staff는 홈 접근 권한이 없어 requireAdmin이 자동으로 /sell로 보낸다.
  redirect("/dashboard");
}
