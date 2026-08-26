import { createClient } from "@supabase/supabase-js";

// ⚠️ service_role 키는 RLS를 완전히 우회하는 관리자 권한 키다.
// 이 파일은 반드시 "use server" 액션 파일에서만 import 할 것 — 클라이언트 컴포넌트에서 절대 사용 금지.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
