"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { askSalesAssistant, type AssistantResult, type PreviousTurn } from "@/lib/sales-assistant";

export type AskResult = ({ ok: true } & AssistantResult) | { ok: false; error: string };

export async function askQuestion(question: string, previous: PreviousTurn[]): Promise<AskResult> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { ok: false, error: "매장을 먼저 선택하세요." };

  const q = question.trim();
  if (!q) return { ok: false, error: "질문을 입력하세요." };
  if (q.length > 500) return { ok: false, error: "질문은 500자 이내로 입력하세요." };

  if (!process.env.ANTHROPIC_API_KEY) {
    // 키 미설정 = 기능 오픈 전. 오류가 아니라 준비 중 안내로 보여준다.
    return { ok: true, answer: "AI 매출 질문은 아직 준비 중이에요. 기능이 열리면 이 질문에 바로 답해 드릴게요.", tables: [] };
  }

  const safePrevious = (Array.isArray(previous) ? previous : [])
    .slice(-4)
    .map((t) => ({ question: String(t.question ?? "").slice(0, 500), answer: String(t.answer ?? "").slice(0, 2000) }));

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
      console.error("sales assistant API error", e.status, e.message);
      return { ok: false, error: "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    console.error("sales assistant error", e);
    return { ok: false, error: "조회 중 오류가 발생했습니다." };
  }
}
