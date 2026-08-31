import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWinbackScan } from "@/lib/winback-scan";

// Vercel Cron이 매일 호출(vercel.json 참고). CRON_SECRET 환경변수를 설정해두면
// Vercel이 자동으로 Authorization: Bearer <값> 헤더를 붙여서 호출한다.
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
    const issued = await runWinbackScan(supabase, store.id);
    results.push({ storeId: store.id, issuedCount: issued.length, issued });
  }

  return NextResponse.json({ ok: true, results });
}
