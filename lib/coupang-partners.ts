import crypto from "crypto";

// 쿠팡파트너스 Open API로 일반 쿠팡 상품 URL을 수수료 추적이 붙는 딥링크로 변환한다.
// 자격증명(COUPANG_PARTNERS_ACCESS_KEY / SECRET_KEY)이 없거나 API 호출이 실패하면
// 원본 URL을 그대로 반환한다 — 발주 자체는 파트너스 연동 전에도 동작해야 하고,
// 나중에 키만 넣으면 수수료 추적이 자동으로 붙기 시작한다.
//
// ⚠️ 실제 계정 키가 없어 이 세션에서 end-to-end 호출을 검증하지 못했다.
// 서명 방식(HMAC-SHA256, "CEA algorithm=..." Authorization 헤더)은 쿠팡파트너스
// Open API 공식 문서 기준으로 구현했으니, 키를 넣은 뒤 실제 발주 한 번으로
// 응답 형식이 맞는지 확인이 필요하다.
const API_HOST = "api-gateway.coupang.com";
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";

function buildAuthHeader(method: string, path: string, accessKey: string, secretKey: string) {
  const signedDate = new Date()
    .toISOString()
    .replace(/[-:]|\.\d+/g, "")
    .slice(0, 15) + "Z"; // yyMMddTHHmmssZ 형태

  const message = signedDate + method + path;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

export async function createCoupangDeepLink(productUrl: string): Promise<string> {
  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY;
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return productUrl;
  }

  try {
    const authorization = buildAuthHeader("POST", DEEPLINK_PATH, accessKey, secretKey);
    const res = await fetch(`https://${API_HOST}${DEEPLINK_PATH}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coupangUrls: [productUrl] }),
    });

    if (!res.ok) return productUrl;

    const data = await res.json();
    const shortenUrl = data?.data?.[0]?.shortenUrl;
    return typeof shortenUrl === "string" && shortenUrl ? shortenUrl : productUrl;
  } catch {
    return productUrl;
  }
}
