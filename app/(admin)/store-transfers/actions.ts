"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore, getAccessibleStores } from "@/lib/session";
import type { StockTransferReason } from "@/lib/types";

export type StoreTransferState = { error: string | null; success: string | null };

// 지금 선택된 매장(보내는 매장)에서 다른 매장으로 재고를 옮긴다. 차감·증가·상품 자동 생성·
// 소비기한 이동·내역 기록은 DB 함수(transfer_stock) 안에서 한 번에 처리된다.
export async function transferStock(
  _prevState: StoreTransferState,
  formData: FormData
): Promise<StoreTransferState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  const barcode = String(formData.get("barcode") ?? "").trim();
  const to_store_id = String(formData.get("to_store_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  const reason = String(formData.get("reason") ?? "") as StockTransferReason;
  const expiry_date = String(formData.get("expiry_date") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!barcode) return { error: "상품을 먼저 조회하세요.", success: null };
  if (!to_store_id) return { error: "받는 매장을 선택하세요.", success: null };
  if (quantity <= 0) return { error: "이동 수량을 확인하세요.", success: null };

  const stores = await getAccessibleStores(supabase);
  const toStore = stores.find((s) => s.id === to_store_id);
  if (!toStore || toStore.id === store.id) return { error: "받는 매장을 다시 선택하세요.", success: null };

  const { data, error } = await supabase.rpc("transfer_stock", {
    p_from_store_id: store.id,
    p_to_store_id: to_store_id,
    p_barcode: barcode,
    p_quantity: quantity,
    p_reason: reason,
    p_expiry_date: expiry_date,
    p_memo: memo,
  });
  if (error) return { error: error.message, success: null };

  revalidatePath("/store-transfers");
  revalidatePath("/products");
  revalidatePath("/expiry");
  const created = (data as { created_product?: boolean } | null)?.created_product;
  return {
    error: null,
    success: `${toStore.name}(으)로 ${quantity}개를 옮겼습니다.${
      created ? ` ${toStore.name}에 없던 상품이라 같은 정보로 새로 등록했어요.` : ""
    }`,
  };
}
