import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 무인매장이라 거스름돈이 모자란 순간 그 자리에 직원이 없다 — 그래서 고객이
// 키오스크 화면(/kiosk/[id]/change-request)에서 직접 부족한 금액과 계좌를 입력해서
// 보내는 공개 엔드포인트. 로그인이 없으므로 서비스 롤로 쓴다(다른 /api/kiosk/* 와 동일 패턴).
//
// ⚠️ 보안/운영 주의: 인증되지 않은 공개 입력이라 "실제로 거스름돈이 모자랐는지"를
// 서버가 검증할 방법이 없다(결제 연동이 없어 sale_id를 연결할 수 없음). 금액 상한과
// 필수값 검사만 두고, 본사가 지급 전에 반드시 사람이 한 번 더 확인(CCTV·시재 대조 등)
// 하는 걸 전제로 한다 — 추후 키오스크 결제 흐름이 생기면 sale_id로 실제 거래와
// 연결해서 이 문제를 없앨 수 있다(인수인계서 4번 참고).
const MAX_AMOUNT = 50000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kiosk_id = String(body?.kiosk_id ?? "");
  const amount = Number(body?.amount ?? 0);
  const bank_name = String(body?.bank_name ?? "").trim();
  const account_number = String(body?.account_number ?? "").trim();
  const account_holder = String(body?.account_holder ?? "").trim();
  const customer_phone = String(body?.customer_phone ?? "").trim() || null;

  if (!kiosk_id) {
    return NextResponse.json({ error: "kiosk_id가 필요합니다." }, { status: 400 });
  }
  if (!bank_name || !account_number || !account_holder) {
    return NextResponse.json({ error: "은행명·계좌번호·예금주를 입력하세요." }, { status: 400 });
  }
  if (!amount || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `금액은 1원 이상 ${MAX_AMOUNT.toLocaleString()}원 이하만 등록할 수 있습니다.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("store_id").eq("id", kiosk_id).maybeSingle();
  if (!kiosk) {
    return NextResponse.json({ error: "키오스크를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await admin.from("change_transfer_requests").insert({
    store_id: kiosk.store_id,
    bank_name,
    account_number,
    account_holder,
    customer_phone,
    amount,
    memo: "키오스크에서 고객이 직접 등록",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
