import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANK_NAMES } from "@/lib/types";
import { raiseKioskAlert } from "@/lib/kiosk-alerts";

// 무인매장이라 거스름돈을 못 받은 순간 그 자리에 직원이 없다 — 그래서 고객이
// 키오스크 화면(/kiosk/[id]/change-request)에서 직접 받지 못한 금액과 계좌를 입력해서
// 보내는 공개 엔드포인트. 로그인이 없으므로 서비스 롤로 쓴다(다른 /api/kiosk/* 와 동일 패턴).
// 받는 방법은 계좌이체 하나뿐이다(교환권 등 다른 방법은 두지 않음).
//
// 개인정보 최소 수집: 은행명·계좌번호만 받는다. 예금주 이름·연락처는 요청 본문에 들어와도
// 저장하지 않는다. 개인정보 수집·이용 동의(privacy_consent=true) 없이는 등록하지 않는다.
//
// ⚠️ 보안/운영 주의: 인증되지 않은 공개 입력이라 "실제로 거스름돈을 못 받았는지"를
// 서버가 검증할 방법이 없다(결제 연동이 없어 sale_id를 연결할 수 없음). 금액 상한과
// 필수값 검사만 두고, 본사가 지급 전에 반드시 사람이 한 번 더 확인(CCTV·시재 대조 등)
// 하는 걸 전제로 한다 — 추후 키오스크 결제 흐름이 생기면 sale_id로 실제 거래와
// 연결해서 이 문제를 없앨 수 있다(인수인계서 4번 참고).
const MAX_AMOUNT = 50000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kiosk_id = String(body?.kiosk_id ?? "");
  const reason = String(body?.reason ?? "");
  const amount = Number(body?.amount ?? 0);
  const bank_name = String(body?.bank_name ?? "").trim();
  const account_number = String(body?.account_number ?? "").replace(/[^0-9]/g, "");
  const privacy_consent = body?.privacy_consent === true;

  if (!kiosk_id) {
    return NextResponse.json({ error: "kiosk_id가 필요합니다." }, { status: 400 });
  }
  if (reason !== "change_shortage" && reason !== "dispense_error") {
    return NextResponse.json({ error: "사유를 선택하세요." }, { status: 400 });
  }
  if (!privacy_consent) {
    return NextResponse.json({ error: "개인정보 수집·이용에 동의해야 등록할 수 있습니다." }, { status: 400 });
  }
  if (!(BANK_NAMES as readonly string[]).includes(bank_name)) {
    return NextResponse.json({ error: "은행을 선택하세요." }, { status: 400 });
  }
  if (account_number.length < 10 || account_number.length > 16) {
    return NextResponse.json({ error: "계좌번호를 확인하세요(숫자 10~16자리)." }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `금액은 1원 이상 ${MAX_AMOUNT.toLocaleString()}원 이하만 등록할 수 있습니다.` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("kiosks").select("id, store_id, name").eq("id", kiosk_id).maybeSingle();
  if (!kiosk) {
    return NextResponse.json({ error: "키오스크를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await admin.from("change_transfer_requests").insert({
    store_id: kiosk.store_id,
    kiosk_id,
    reason,
    bank_name,
    account_number,
    amount,
    privacy_consent_at: new Date().toISOString(),
    memo: "키오스크에서 고객이 직접 등록",
  });
  if (error) {
    console.error("change request insert failed", error.message);
    return NextResponse.json({ error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  // 거스름돈을 못 준 것 자체가 장비 이상 신호(잔돈 부족·배출 오류)라 알림도 같이 띄운다.
  // 계좌번호 같은 개인정보는 알림 문구에 넣지 않는다.
  try {
    await raiseKioskAlert(
      admin,
      kiosk,
      "change_failed",
      `거스름돈 ${amount.toLocaleString()}원 미지급(${reason === "change_shortage" ? "잔돈 부족" : "배출 오류"}) — 계좌이체 요청이 접수되었습니다.`
    );
  } catch (e) {
    console.error("change_failed alert failed", e);
  }

  return NextResponse.json({ ok: true });
}
