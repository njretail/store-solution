"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { AGENCY_SERVICES, submitAgencyToHomepage } from "@/lib/homepage-agency";

export type AgencyFormState = { error: string | null; success: string | null };

export async function submitAgencyRequest(
  _prevState: AgencyFormState,
  formData: FormData
): Promise<AgencyFormState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const services = formData.getAll("services").map(String);
  const valid = AGENCY_SERVICES.map((s) => s.value as string);
  const picked = services.filter((s) => valid.includes(s));
  if (picked.length === 0) return { error: "신청할 서비스를 하나 이상 선택하세요.", success: null };
  // 홈페이지 폼과 같은 값으로 맞춘다(두 개 다 고르면 "두 서비스 모두").
  const service_type = picked.length === valid.length ? "두 서비스 모두" : picked[0];

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "").trim();
  const detail = String(formData.get("message") ?? "").trim();
  if (!name || !phone) return { error: "신청자 이름과 연락처를 입력하세요.", success: null };

  const message = [schedule && `희망 일정: ${schedule}`, detail].filter(Boolean).join("\n") || null;

  const result = await submitAgencyToHomepage({
    store_id: store.id,
    store_name: store.name,
    store_location: store.address ?? store.name,
    name,
    phone,
    service_type,
    message,
  });
  if (!result.ok) return { error: result.error, success: null };

  revalidatePath("/agency");
  return { error: null, success: "대행 신청이 접수되었습니다. 본사에서 확인 후 연락드립니다." };
}
