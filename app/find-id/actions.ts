"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type FindIdState = { result: string | null; error: string | null };

// 이메일 앞부분 일부만 남기고 가려서 보여준다. 예: "hong123@gmail.com" -> "ho****3@gmail.com"
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) {
    return `${local[0] ?? ""}***@${domain ?? ""}`;
  }
  const visibleStart = local.slice(0, 2);
  const visibleEnd = local.length > 4 ? local.slice(-1) : "";
  const maskedLen = local.length - visibleStart.length - visibleEnd.length;
  return `${visibleStart}${"*".repeat(Math.max(maskedLen, 2))}${visibleEnd}@${domain}`;
}

export async function findId(
  _prevState: FindIdState,
  formData: FormData
): Promise<FindIdState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !phone) {
    return { result: null, error: "이름과 전화번호를 모두 입력하세요." };
  }

  // RLS를 우회해야 로그인 전 상태에서도 조회할 수 있다 — 이름+전화번호가 정확히 일치할 때만 결과를 준다.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("name", name)
    .eq("phone", phone)
    .not("email", "is", null);

  if (error) {
    return { result: null, error: "조회 중 오류가 발생했습니다." };
  }
  if (!data || data.length === 0) {
    return { result: null, error: "일치하는 계정을 찾을 수 없습니다." };
  }

  const masked = data.map((row) => maskEmail(row.email as string)).join(", ");
  return { result: masked, error: null };
}
