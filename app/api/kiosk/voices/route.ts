import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_VOICE_TAGS, type CustomerVoiceKind } from "@/lib/types";

// 고객의 소리 — 키오스크 화면(/kiosk/[id]/voice)에서 고객이 남긴 의견을 받는 공개
// 엔드포인트. 로그인이 없으므로 서비스 롤로 쓴다(다른 /api/kiosk/* 와 같은 패턴).
// 이름·연락처는 받지 않는다(본문에 들어와도 저장하지 않음).
//
// 인증 없는 공개 입력이라 장난 도배를 막기 위해 키오스크 한 대당 10분에 20건까지만 받는다
// (정상 이용이라면 한 사람이 몇 건 남기는 수준이라 넉넉한 기준).
const MAX_MESSAGE = 300;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 20;
const KINDS: CustomerVoiceKind[] = ["product_request", "complaint", "compliment", "other"];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kiosk_id = String(body?.kiosk_id ?? "");
  const kind = String(body?.kind ?? "") as CustomerVoiceKind;
  const message = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE);
  const rawTags: unknown[] = Array.isArray(body?.tags) ? body.tags : [];

  if (!kiosk_id) {
    return NextResponse.json({ error: "kiosk_id가 필요합니다." }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "의견 종류를 선택하세요." }, { status: 400 });
  }
  // 분류 버튼은 그 종류에 정해진 것만 받는다(임의 문자열이 태그로 쌓이지 않게).
  const allowed: readonly string[] =
    kind === "product_request" || kind === "complaint" ? CUSTOMER_VOICE_TAGS[kind] : [];
  const tags = [...new Set(rawTags.map(String))].filter((t) => allowed.includes(t));
  if (tags.length === 0 && !message) {
    return NextResponse.json({ error: "분류를 고르거나 내용을 입력해 주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("id, store_id").eq("id", kiosk_id).maybeSingle();
  if (!kiosk) {
    return NextResponse.json({ error: "키오스크를 찾을 수 없습니다." }, { status: 404 });
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("customer_voices")
    .select("id", { count: "exact", head: true })
    .eq("kiosk_id", kiosk_id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { error } = await admin.from("customer_voices").insert({
    store_id: kiosk.store_id,
    kiosk_id,
    kind,
    tags,
    message: message || null,
  });
  if (error) {
    console.error("customer voice insert failed", error.message);
    return NextResponse.json({ error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
