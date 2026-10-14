import { requireAdmin, getCurrentStore } from "@/lib/session";
import { isAiSearchEnabled } from "./actions";
import AskClient from "./AskClient";

// AI가 조회 도구를 여러 번 호출하면 수십 초가 걸릴 수 있어 서버 액션 제한 시간을 늘린다.
export const maxDuration = 120;

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { q } = await searchParams;
  const initialQuestion = (q ?? "").trim().slice(0, 500);
  const enabled = await isAiSearchEnabled();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">AI 통합 검색</h1>
        <p className="text-sm text-zinc-500">
          {store.name} — 상품·재고·판매·고객·발주·현금·키오스크 등 솔루션의 모든 데이터를 말하듯 물어보세요.
        </p>
      </div>
      {!enabled && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI 통합 검색은 준비 중이에요. 데이터 이용 동의·승인 절차가 끝나면 열어드릴게요. 지금은 질문을
          입력해도 매장 데이터가 외부로 전송되지 않습니다.
        </p>
      )}
      {/* /ask?q=... 링크로 다른 질문을 들고 들어오면 새 대화로 시작하도록 key로 초기화 */}
      <AskClient key={initialQuestion} initialQuestion={initialQuestion} />
    </div>
  );
}
