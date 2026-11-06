import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutoOrderScan } from "@/lib/auto-order-scan";
import { AUTO_ORDER_ENABLED } from "@/lib/features";

// Vercel Cron이 주기 호출(vercel.json 참고). CRON_SECRET 환경변수를 설정해두면
// Vercel이 자동으로 Authorization: Bearer <값> 헤더를 붙여서 호출한다.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 자동발주를 잠시 꺼둔 동안에는 아무 발주도 만들지 않는다(lib/features.ts).
  if (!AUTO_ORDER_ENABLED) {
    return NextResponse.json({ ok: true, paused: true, results: [] });
  }

  const supabase = createAdminClient();
  const { data: stores, error } = await supabase.from("stores").select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const store of stores ?? []) {
    const created = await runAutoOrderScan(supabase, store.id);
    results.push({ storeId: store.id, orderedCount: created.length, created });
  }

  return NextResponse.json({ ok: true, results });
}
