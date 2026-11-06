import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutoOrderScan } from "@/lib/auto-order-scan";
import { AUTO_ORDER_ENABLED } from "@/lib/features";
import { recalcThresholdsFromSales } from "@/lib/threshold-from-sales";

// Vercel Cron이 매일 새벽 호출(vercel.json 참고). CRON_SECRET 환경변수를 설정해두면
// Vercel이 자동으로 Authorization: Bearer <값> 헤더를 붙여서 호출한다.
// 1) 매장마다 최근 7일 판매량으로 적정재고를 다시 계산해 반영한다(항상).
// 2) 자동발주가 켜져 있을 때만(lib/features.ts) 이어서 자동발주를 돌린다 — 지금은 물류창고
//    확보 전이라 꺼져 있다. 새 적정재고 기준으로 발주하도록 1) 다음에 둔다.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: stores, error } = await supabase.from("stores").select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const store of stores ?? []) {
    let thresholds: unknown;
    try {
      thresholds = await recalcThresholdsFromSales(supabase, store.id);
    } catch (e) {
      thresholds = { error: e instanceof Error ? e.message : String(e) };
    }

    const created = AUTO_ORDER_ENABLED ? await runAutoOrderScan(supabase, store.id) : [];
    results.push({
      storeId: store.id,
      thresholds,
      autoOrderPaused: !AUTO_ORDER_ENABLED,
      orderedCount: created.length,
      created,
    });
  }

  return NextResponse.json({ ok: true, results });
}
