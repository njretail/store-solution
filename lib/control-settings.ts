import type { SupabaseClient } from "@supabase/supabase-js";

export type ControlLevel = "hq_fixed" | "hq_default_store_adjust" | "store_free";

export const CONTROL_LEVEL_LABELS: Record<ControlLevel, string> = {
  hq_fixed: "① 본사 고정",
  hq_default_store_adjust: "② 기본값 + 점포 조정",
  store_free: "③ 점포 자율",
};

export type StoreType = "direct" | "franchise";

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  direct: "직영점",
  franchise: "가맹점",
};

// 기술 인수인계서 2-1-c의 항목별 권고 표와 같은 목록. "취급 상품 범위"는 이미
// 점포 자율로 확정(2026-10)돼서 설정 항목에서 뺐다 — 항상 store_free로 취급한다.
export const CONTROL_SETTING_ITEMS = [
  { key: "supply_price", label: "공급가(원가)" },
  { key: "sell_price", label: "판매가" },
  { key: "margin_percent", label: "마진율" },
  { key: "coupon_issue", label: "쿠폰 발행" },
  { key: "promotion", label: "기간한정 할인" },
  { key: "external_purchase", label: "외부 매입(대량매입 엑셀)" },
] as const;

export type ControlSettingKey = (typeof CONTROL_SETTING_ITEMS)[number]["key"];

export type ControlSettingRow = {
  id: string;
  setting_key: string;
  scope_type: "global" | "store_type" | "store";
  // global이면 빈 문자열, store_type이면 'direct'|'franchise', store면 매장 id.
  scope_value: string;
  control_level: ControlLevel;
};

// 지금은 관리자(admin) 혼자 본사+점포 역할을 겸하고 있어서 이 함수가 어디서도
// 호출되지 않는다(아무것도 막지 않음). 본사/직영/가맹 메뉴가 역할로 분리되면
// (기술 인수인계서 3번) 그 화면들이 이 함수로 통제수준을 확인해서 점포 역할의
// 수정 권한을 걸러내면 된다 — 설정 자체는 미리 만들어두는 것.
export function resolveControlLevel(
  rows: ControlSettingRow[],
  settingKey: string,
  store: { id: string; store_type: string }
): ControlLevel {
  const storeRow = rows.find((r) => r.scope_type === "store" && r.scope_value === store.id);
  if (storeRow) return storeRow.control_level;

  const typeRow = rows.find(
    (r) => r.scope_type === "store_type" && r.scope_value === store.store_type
  );
  if (typeRow) return typeRow.control_level;

  const globalRow = rows.find((r) => r.scope_type === "global" && r.setting_key === settingKey);
  if (globalRow) return globalRow.control_level;

  // 아무 정책도 설정 안 해뒀으면 지금까지와 동일하게 점포 자율(제한 없음).
  return "store_free";
}

export async function fetchControlSettings(supabase: SupabaseClient): Promise<ControlSettingRow[]> {
  const { data } = await supabase
    .from("control_settings")
    .select("id, setting_key, scope_type, scope_value, control_level");
  return (data ?? []) as ControlSettingRow[];
}
