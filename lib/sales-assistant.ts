import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { buildProductRanking, kstDateKey, kstHour, type ProductInfo } from "@/lib/product-stats";
import { paymentMethodLabel } from "@/lib/types";

// "7월에 가장 많이 팔린 품목 알려줘" 같은 자연어 질문에 답하는 매출 질문 도우미.
// AI(Claude)는 DB에 직접 접근하지 않고, 여기 정의한 조회 도구(get_sales_summary,
// get_product_ranking, list_categories)만 호출할 수 있다. 도구는 로그인한 사용자의
// supabase 클라이언트(RLS 적용)로 "현재 선택된 매장" 데이터만 조회하므로, 질문 내용과
// 상관없이 다른 매장 데이터는 볼 수 없다. 화면에 보여주는 표도 AI가 쓴 숫자가 아니라
// 도구가 실제로 계산한 값을 그대로 쓴다(AI 답변 문장은 요약 용도).

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;
const MAX_RANGE_DAYS = 366;

export type AnswerTable = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  link?: string;
};

export type AssistantResult = {
  answer: string;
  tables: AnswerTable[];
};

export type PreviousTurn = { question: string; answer: string };

type StoreContext = { supabase: SupabaseClient; storeId: string; storeName: string };

type SaleRow = { id: string; total_amount: number; payment_method: string; created_at: string };
type ItemRow = {
  product_id: string;
  quantity: number;
  subtotal: number;
  unit_cost: number;
  created_at: string;
};

function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 도구 입력의 from/to는 "KST 기준 날짜(YYYY-MM-DD, 양끝 포함)" — 상품통계 화면과 같은 규칙.
function parseRange(input: Record<string, unknown>): { from: string; to: string; fromIso: string; toIso: string } {
  const from = String(input.from ?? "");
  const to = String(input.to ?? "");
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) throw new Error("from/to는 YYYY-MM-DD 형식이어야 합니다.");
  if (from > to) throw new Error("from이 to보다 늦습니다.");
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  if (days > MAX_RANGE_DAYS) throw new Error(`조회 기간은 최대 ${MAX_RANGE_DAYS}일입니다.`);
  return {
    from,
    to,
    fromIso: new Date(`${from}T00:00:00+09:00`).toISOString(),
    toIso: new Date(`${addDaysStr(to, 1)}T00:00:00+09:00`).toISOString(),
  };
}

async function fetchSales(ctx: StoreContext, fromIso: string, toIso: string) {
  return fetchAllPages<SaleRow>((rangeFrom, rangeTo) =>
    ctx.supabase
      .from("sales")
      .select("id, total_amount, payment_method, created_at")
      .eq("store_id", ctx.storeId)
      .eq("status", "completed")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .range(rangeFrom, rangeTo)
  );
}

async function fetchItems(ctx: StoreContext, fromIso: string, toIso: string) {
  return fetchAllPages<ItemRow>((rangeFrom, rangeTo) =>
    ctx.supabase
      .from("sale_items")
      .select("product_id, quantity, subtotal, unit_cost, sales!inner(created_at, status)")
      .eq("store_id", ctx.storeId)
      .eq("sales.status", "completed")
      .gte("sales.created_at", fromIso)
      .lt("sales.created_at", toIso)
      .range(rangeFrom, rangeTo)
      .then((res) => ({
        data:
          (res.data as unknown as Array<{
            product_id: string;
            quantity: number;
            subtotal: number;
            unit_cost: number;
            sales: { created_at: string } | { created_at: string }[];
          }> | null)?.map((row) => ({
            product_id: row.product_id,
            quantity: row.quantity,
            subtotal: row.subtotal,
            unit_cost: row.unit_cost,
            created_at: Array.isArray(row.sales) ? row.sales[0]?.created_at : row.sales.created_at,
          })) ?? null,
        error: res.error,
      }))
  );
}

async function fetchCatalog(ctx: StoreContext) {
  const [products, { data: categoriesData }] = await Promise.all([
    fetchAllPages<ProductInfo>((rangeFrom, rangeTo) =>
      ctx.supabase
        .from("products")
        .select("id, name, category_id, stock_qty")
        .eq("store_id", ctx.storeId)
        .range(rangeFrom, rangeTo)
    ),
    ctx.supabase.from("categories").select("id, name").order("name"),
  ]);
  return {
    productMap: new Map(products.map((p) => [p.id, p])),
    categories: new Map((categoriesData ?? []).map((c) => [c.id as string, c.name as string])),
  };
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 월요일 시작 주 — "YYYY-MM-DD 주"로 표시한다.
function weekKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return `${addDaysStr(dateKey, -offset)} 주`;
}

type GroupBy = "none" | "day" | "week" | "month" | "hour" | "weekday" | "payment_method" | "category";

async function runSalesSummary(ctx: StoreContext, input: Record<string, unknown>): Promise<AnswerTable> {
  const { from, to, fromIso, toIso } = parseRange(input);
  const groupBy = String(input.group_by ?? "none") as GroupBy;

  if (groupBy === "category") {
    const [items, { productMap, categories }] = await Promise.all([fetchItems(ctx, fromIso, toIso), fetchCatalog(ctx)]);
    const byCat = new Map<string, { revenue: number; qty: number; cost: number }>();
    for (const it of items) {
      const p = productMap.get(it.product_id);
      const cat = (p?.category_id && categories.get(p.category_id)) || "미분류";
      const agg = byCat.get(cat) ?? { revenue: 0, qty: 0, cost: 0 };
      agg.revenue += it.subtotal;
      agg.qty += it.quantity;
      agg.cost += it.unit_cost * it.quantity;
      byCat.set(cat, agg);
    }
    const total = [...byCat.values()].reduce((s, a) => s + a.revenue, 0);
    const rows = [...byCat.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([cat, a]) => [
        cat,
        a.revenue,
        a.qty,
        a.revenue - a.cost,
        total > 0 ? `${((a.revenue / total) * 100).toFixed(1)}%` : "0%",
      ]);
    return {
      title: `카테고리별 매출 (${from} ~ ${to})`,
      columns: ["카테고리", "판매금액(원)", "판매수량", "매출총이익(원)", "비중"],
      rows,
    };
  }

  const [sales, items] = await Promise.all([fetchSales(ctx, fromIso, toIso), fetchItems(ctx, fromIso, toIso)]);

  const keyOf = (iso: string, method: string): string => {
    const day = kstDateKey(iso);
    switch (groupBy) {
      case "day":
        return day;
      case "week":
        return weekKey(day);
      case "month":
        return day.slice(0, 7);
      case "hour":
        return `${String(kstHour(iso)).padStart(2, "0")}시`;
      case "weekday":
        return `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]}요일`;
      case "payment_method":
        return paymentMethodLabel(method);
      default:
        return `${from} ~ ${to}`;
    }
  };

  const groups = new Map<string, { revenue: number; count: number; itemRevenue: number; cost: number }>();
  const get = (k: string) => {
    const g = groups.get(k) ?? { revenue: 0, count: 0, itemRevenue: 0, cost: 0 };
    groups.set(k, g);
    return g;
  };

  // 날짜 단위 그룹은 판매가 없는 날도 0으로 보여야 "그 날 빠짐"과 "0원"이 구분된다.
  if (groupBy === "day") {
    for (let d = from; d <= to; d = addDaysStr(d, 1)) get(d);
  }

  const saleMethod = new Map<string, string>();
  for (const s of sales) {
    saleMethod.set(s.id, s.payment_method);
    const g = get(keyOf(s.created_at, s.payment_method));
    g.revenue += s.total_amount;
    g.count += 1;
  }
  // 결제수단별 그룹에서는 품목 단위 매출총이익을 나누기 어려워(품목에 결제수단이 없음) 생략한다.
  if (groupBy !== "payment_method") {
    for (const it of items) {
      const g = get(keyOf(it.created_at, ""));
      g.itemRevenue += it.subtotal;
      g.cost += it.unit_cost * it.quantity;
    }
  }

  const entries = [...groups.entries()];
  if (groupBy === "payment_method") entries.sort((a, b) => b[1].revenue - a[1].revenue);
  else if (groupBy === "weekday") {
    const order = (k: string) => (WEEKDAYS.indexOf(k[0]) + 6) % 7;
    entries.sort((a, b) => order(a[0]) - order(b[0]));
  } else entries.sort((a, b) => a[0].localeCompare(b[0]));

  const columns = ["구분", "매출(원)", "판매건수", "건당평균(원)"];
  if (groupBy !== "payment_method") columns.push("매출총이익(원)", "마진율");

  const rows = entries.map(([k, g]) => {
    const row: (string | number)[] = [k, g.revenue, g.count, g.count > 0 ? Math.round(g.revenue / g.count) : 0];
    if (groupBy !== "payment_method") {
      const profit = g.itemRevenue - g.cost;
      row.push(profit, g.itemRevenue > 0 ? `${((profit / g.itemRevenue) * 100).toFixed(1)}%` : "-");
    }
    return row;
  });

  const groupLabel: Record<GroupBy, string> = {
    none: "매출 요약",
    day: "일별 매출",
    week: "주별 매출",
    month: "월별 매출",
    hour: "시간대별 매출",
    weekday: "요일별 매출",
    payment_method: "결제수단별 매출",
    category: "카테고리별 매출",
  };

  return { title: `${groupLabel[groupBy]} (${from} ~ ${to})`, columns, rows };
}

async function runProductRanking(ctx: StoreContext, input: Record<string, unknown>): Promise<AnswerTable> {
  const { from, to, fromIso, toIso } = parseRange(input);
  const sortBy = input.sort_by === "quantity" ? "quantity" : "revenue";
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : null;
  const keyword =
    typeof input.product_keyword === "string" && input.product_keyword.trim() ? input.product_keyword.trim() : null;

  const [items, { productMap, categories }] = await Promise.all([fetchItems(ctx, fromIso, toIso), fetchCatalog(ctx)]);

  let ranking = buildProductRanking(items, productMap, categories);
  if (category) ranking = ranking.filter((r) => r.category.includes(category));
  if (keyword) ranking = ranking.filter((r) => r.name.includes(keyword));
  if (sortBy === "quantity") ranking = [...ranking].sort((a, b) => b.quantity - a.quantity);

  const filterLabel = [category && `카테고리 "${category}"`, keyword && `"${keyword}" 포함`].filter(Boolean).join(", ");

  return {
    title: `상품 ${sortBy === "quantity" ? "판매수량" : "매출액"} 순위 (${from} ~ ${to}${filterLabel ? `, ${filterLabel}` : ""})`,
    columns: ["순위", "상품명", "카테고리", "판매수량", "매출액(원)", "매출비중", "등급"],
    rows: ranking
      .slice(0, limit)
      .map((r, i) => [i + 1, r.name, r.category, r.quantity, r.revenue, `${r.sharePercent.toFixed(1)}%`, r.grade]),
    link: `/statistics/products?preset=custom&from=${from}&to=${to}`,
  };
}

async function runListCategories(ctx: StoreContext): Promise<AnswerTable> {
  const { categories } = await fetchCatalog(ctx);
  return { title: "카테고리 목록", columns: ["카테고리"], rows: [...categories.values()].map((n) => [n]) };
}

export async function runSalesTool(
  ctx: StoreContext,
  name: string,
  input: Record<string, unknown>
): Promise<AnswerTable> {
  if (name === "get_sales_summary") return runSalesSummary(ctx, input);
  if (name === "get_product_ranking") return runProductRanking(ctx, input);
  if (name === "list_categories") return runListCategories(ctx);
  throw new Error(`알 수 없는 도구: ${name}`);
}

const DATE_PROPS = {
  from: { type: "string", description: "시작일(KST, YYYY-MM-DD, 포함)" },
  to: { type: "string", description: "종료일(KST, YYYY-MM-DD, 포함)" },
} as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_sales_summary",
    description:
      "기간 매출을 집계한다. 매출은 결제금액 합계(할인 반영, 취소 제외), 매출총이익은 상품 판매가에서 판매 당시 원가를 뺀 값. " +
      "group_by로 일/주/월/시간대/요일/결제수단/카테고리별로 나눌 수 있다. 두 기간 비교가 필요하면 기간별로 각각 호출한다.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ...DATE_PROPS,
        group_by: {
          type: "string",
          enum: ["none", "day", "week", "month", "hour", "weekday", "payment_method", "category"],
        },
      },
      required: ["from", "to", "group_by"],
      additionalProperties: false,
    },
  },
  {
    name: "get_product_ranking",
    description:
      "기간 내 상품별 판매수량·매출액 순위를 조회한다(취소 제외). '가장 많이 팔린' 질문에서 개수 기준이면 sort_by=quantity, " +
      "금액 기준이면 revenue. category는 카테고리 이름 일부, product_keyword는 상품명 일부로 거른다(필요 없으면 null).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ...DATE_PROPS,
        sort_by: { type: "string", enum: ["revenue", "quantity"] },
        limit: { type: "integer", description: "1~50" },
        category: { type: ["string", "null"] },
        product_keyword: { type: ["string", "null"] },
      },
      required: ["from", "to", "sort_by", "limit", "category", "product_keyword"],
      additionalProperties: false,
    },
  },
  {
    name: "list_categories",
    description: "매장의 상품 카테고리 이름 목록. 질문 속 카테고리 표현을 실제 이름에 맞출 때 쓴다.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

function tableToText(t: AnswerTable): string {
  const MAX_ROWS = 100;
  const lines = [t.title, t.columns.join(" | "), ...t.rows.slice(0, MAX_ROWS).map((r) => r.join(" | "))];
  if (t.rows.length > MAX_ROWS) lines.push(`... 외 ${t.rows.length - MAX_ROWS}행`);
  if (t.rows.length === 0) lines.push("(해당 기간 데이터 없음)");
  return lines.join("\n");
}

function systemPrompt(storeName: string): string {
  return `당신은 무인매장 관리 솔루션의 매출 분석 도우미입니다. 점주가 "${storeName}" 매장의 매출·상품 판매에 대해 묻습니다.

- 반드시 제공된 도구로 실제 데이터를 조회한 뒤 답하세요. 숫자를 추측하거나 지어내지 마세요.
- 날짜는 한국 시간 기준입니다. 연도 없이 "7월"처럼 말하면, 오늘 이전의 가장 최근 해당 월로 해석하세요. 진행 중인 달은 오늘까지로 잡으세요.
- "가장 많이 팔린"은 기본적으로 판매수량 기준으로 보되, 매출액 1위가 다르면 함께 언급하세요.
- 답변은 한국어로, 핵심 결론을 첫 문장에 쓰고 3~6문장 이내로 짧게 정리하세요. 조회 결과 표는 화면에 따로 표시되므로 표를 다시 옮겨 적지 말고, 눈에 띄는 점(1위 상품, 비중, 증감 등)만 짚어 주세요.
- 마크다운 기호(#, **, |, - 목록 등)는 쓰지 말고 일반 문장으로 쓰세요.
- 매출 데이터로 답할 수 없는 질문이면 그렇다고 말하고, 답할 수 있는 질문 예시를 알려주세요.`;
}

export async function askSalesAssistant(
  ctx: StoreContext,
  question: string,
  previous: PreviousTurn[]
): Promise<AssistantResult> {
  const client = new Anthropic();

  // 이전 질문·답변은 대화 맥락("그럼 8월은?")용으로 텍스트로만 덧붙인다.
  const context = previous
    .slice(-4)
    .map((t) => `점주: ${t.question}\n도우미: ${t.answer}`)
    .join("\n\n");
  const userText =
    `오늘 날짜(KST): ${kstTodayStr()}\n` +
    (context ? `\n이전 대화:\n${context}\n\n` : "\n") +
    `질문: ${question}`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userText }];
  const tables: AnswerTable[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: systemPrompt(ctx.storeName),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { answer: "이 질문에는 답변할 수 없어요. 매출이나 상품 판매에 관한 질문으로 다시 물어봐 주세요.", tables };
    }

    if (response.stop_reason !== "tool_use") {
      const answer = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { answer: answer || "답변을 만들지 못했어요. 질문을 조금 바꿔서 다시 물어봐 주세요.", tables };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      toolUses.map(async (tool): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const table = await runSalesTool(ctx, tool.name, (tool.input ?? {}) as Record<string, unknown>);
          if (tool.name !== "list_categories") tables.push(table);
          return { type: "tool_result", tool_use_id: tool.id, content: tableToText(table) };
        } catch (e) {
          return {
            type: "tool_result",
            tool_use_id: tool.id,
            content: e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.",
            is_error: true,
          };
        }
      })
    );
    messages.push({ role: "user", content: results });
  }

  return { answer: "질문이 너무 복잡해서 정리하지 못했어요. 조금 나눠서 물어봐 주세요.", tables };
}
