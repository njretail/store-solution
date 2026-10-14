"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { askSalesAssistant, type AssistantResult, type PreviousTurn } from "@/lib/sales-assistant";

export type AskResult = ({ ok: true } & AssistantResult) | { ok: false; error: string };

// AI 통합 검색은 매장 데이터를 외부 AI(Anthropic)로 보내 처리하므로, 데이터 이용 동의·승인
// 절차가 끝나기 전까지는 AI를 절대 호출하지 않는다. API 키가 실수로 등록돼 있어도
// AI_SEARCH_ENABLED=true를 명시적으로 켜야만 동작한다.
function aiSearchEnabled(): boolean {
  return process.env.AI_SEARCH_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

const PREPARING_ANSWER =
  "AI 통합 검색은 아직 준비 중이에요. 데이터 이용 동의·승인 절차가 끝나면 이 질문에 바로 답해 드릴게요.";

export async function askQuestion(question: string, previous: PreviousTurn[]): Promise<AskResult> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { ok: false, error: "매장을 먼저 선택하세요." };

  const q = question.trim();
  if (!q) return { ok: false, error: "질문을 입력하세요." };
  if (q.length > 500) return { ok: false, error: "질문은 500자 이내로 입력하세요." };

  if (!aiSearchEnabled()) return { ok: true, answer: PREPARING_ANSWER, tables: [] };

  const safePrevious = (Array.isArray(previous) ? previous : [])
    .slice(-4)
    .map((t) => ({ question: String(t.question ?? "").slice(0, 500), answer: String(t.answer ?? "").slice(0, 2000) }));

  // 지금은 매출·상품 판매 조회 도구만 연결돼 있다. 재고·고객·발주 등 나머지 데이터 도구는
  // 동의·승인 범위가 정해지면 lib/sales-assistant.ts에 같은 방식으로 추가한다.
  try {
    const result = await askSalesAssistant({ supabase, storeId: store.id, storeName: store.name }, q, safePrevious);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "AI 연동 키가 올바르지 않습니다. 관리자에게 문의하세요." };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "요청이 많아 잠시 후 다시 시도해 주세요." };
    }
    if (e instanceof Anthropic.APIError) {
      console.error("ai search API error", e.status, e.message);
      return { ok: false, error: "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    console.error("ai search error", e);
    return { ok: false, error: "조회 중 오류가 발생했습니다." };
  }
}

export async function isAiSearchEnabled(): Promise<boolean> {
  return aiSearchEnabled();
}
