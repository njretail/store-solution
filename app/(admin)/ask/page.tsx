import { requireAdmin, getCurrentStore } from "@/lib/session";
import AskClient from "./AskClient";

// AI가 조회 도구를 여러 번 호출하면 수십 초가 걸릴 수 있어 서버 액션 제한 시간을 늘린다.
export const maxDuration = 120;

export default async function AskPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">AI 매출 질문</h1>
        <p className="text-sm text-zinc-500">
          {store.name} — 매출·상품 판매에 대해 말하듯 물어보면 바로 정리해 드려요.
        </p>
      </div>
      {!process.env.ANTHROPIC_API_KEY && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI 매출 질문은 준비 중이에요. 곧 바로 사용할 수 있도록 열어드릴게요.
        </p>
      )}
      <AskClient />
    </div>
  );
}
