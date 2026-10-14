// 대행 신청(입고·진열 / 청소)은 홈페이지(njretail.co.kr) 관리자 화면에서 홈페이지 접수 건과
// 함께 처리한다 — 그래서 솔루션은 신청을 자체 DB에 저장하지 않고, 홈페이지의 서버 간 연동
// API(/api/solution/agency-requests)로 보내고 진행 상태도 거기서 다시 조회한다.
// 서버 전용(시크릿 사용) — 클라이언트 컴포넌트에서 import하지 않는다.

export const AGENCY_SERVICES = [
  {
    value: "입고 및 매대진열",
    description: "상품 입고 검수부터 수량 확인, 매대 배치와 진열 기준까지 매장에 맞춰 대행합니다.",
    points: ["입고 상품 검수 및 수량 확인", "매장별 매대 진열과 가격표 정리", "재고 흐름 및 진열 상태 점검"],
  },
  {
    value: "청소대행",
    description: "정기적인 매장 청소와 위생 점검으로 고객이 안심하고 이용할 수 있는 환경을 관리합니다.",
    points: ["매장 바닥과 집기 청소", "화장실 및 공용 공간 위생 관리", "청소 체크리스트 기반 방문 점검"],
  },
] as const;

export type AgencyRequestStatus = "new" | "contacted" | "done";

export const AGENCY_STATUS_LABELS: Record<AgencyRequestStatus, string> = {
  new: "접수",
  contacted: "상담 중",
  done: "완료",
};

export type AgencyRequestRow = {
  id: string;
  created_at: string;
  name: string;
  service_type: string;
  message: string | null;
  status: AgencyRequestStatus;
};

function config() {
  const baseUrl = process.env.HOMEPAGE_API_URL?.replace(/\/$/, "");
  const secret = process.env.SOLUTION_API_SECRET;
  if (!baseUrl || !secret) return null;
  return { url: `${baseUrl}/api/solution/agency-requests`, secret };
}

export function isAgencyConfigured(): boolean {
  return config() !== null;
}

export async function submitAgencyToHomepage(input: {
  store_id: string;
  store_name: string;
  store_location: string;
  name: string;
  phone: string;
  service_type: string;
  message: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = config();
  if (!c) return { ok: false, error: "대행 신청 연동이 아직 설정되지 않았습니다. 본사에 문의하세요." };

  try {
    const res = await fetch(c.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.secret}` },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error ?? "신청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "본사 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function listAgencyRequests(storeId: string): Promise<AgencyRequestRow[] | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}?store_id=${encodeURIComponent(storeId)}`, {
      headers: { Authorization: `Bearer ${c.secret}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.requests ?? []) as AgencyRequestRow[];
  } catch {
    return null;
  }
}
