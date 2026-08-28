"use server";

import { revalidatePath } from "next/cache";
import { extractText } from "unpdf";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import {
  parseCoupangText,
  matchProductByName,
  type ParsedRow,
} from "@/lib/coupang-parser";

export type ParseState = { error: string | null; rows: ParsedRow[] };

export async function parsePurchasePdf(
  _prevState: ParseState,
  formData: FormData
): Promise<ParseState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", rows: [] };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "PDF 파일을 선택하세요.", rows: [] };
  }

  const marginPercent =
    Number(formData.get("margin_percent")) || store.default_margin_percent;

  let text: string;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const result = await extractText(data, { mergePages: true });
    text = result.text;
  } catch {
    return { error: "PDF를 읽을 수 없습니다. 파일을 확인해주세요.", rows: [] };
  }

  const rows = parseCoupangText(text, marginPercent);
  if (rows.length === 0) {
    return {
      error: "표를 인식하지 못했습니다. 쿠팡 거래명세표 PDF가 맞는지 확인해주세요.",
      rows: [],
    };
  }

  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, barcode")
    .eq("store_id", store.id);
  const products = productsData ?? [];

  const matchedRows: ParsedRow[] = rows.map((r) => {
    const matched = matchProductByName(r.name, products);
    if (!matched) return r;
    return {
      ...r,
      matchedProductId: matched.id,
      matchedProductName: matched.name,
    };
  });

  return { error: null, rows: matchedRows };
}

export type ConfirmItem = {
  mode: "new" | "existing";
  product_id?: string;
  barcode?: string;
  name: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  is_tax_exempt?: boolean;
};

export type ConfirmState = { error: string | null; success: string | null };

export async function confirmPurchaseImport(
  _prevState: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null };

  let items: ConfirmItem[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "등록할 항목 정보가 올바르지 않습니다.", success: null };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "등록할 항목이 없습니다.", success: null };
  }

  for (const item of items) {
    let productId = item.product_id;

    if (item.mode === "new") {
      if (!item.barcode) {
        return { error: `${item.name}: 바코드를 입력하세요.`, success: null };
      }
      const { data: created, error: insertError } = await supabase
        .from("products")
        .insert({
          store_id: store.id,
          barcode: item.barcode,
          name: item.name,
          cost_price: item.cost_price,
          sell_price: item.sell_price,
          is_tax_exempt: item.is_tax_exempt ?? false,
          stock_qty: 0,
          low_stock_threshold: 5,
        })
        .select()
        .single();

      if (insertError || !created) {
        const message = insertError?.message.includes("duplicate")
          ? `${item.name}: 이미 등록된 바코드입니다.`
          : `${item.name}: ${insertError?.message ?? "상품 등록에 실패했습니다."}`;
        return { error: message, success: null };
      }
      productId = created.id;
    }

    if (!productId) {
      return { error: `${item.name}: 매칭할 상품을 선택하세요.`, success: null };
    }

    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: productId,
      p_quantity: item.quantity,
      p_unit_cost: item.cost_price,
      p_memo: "쿠팡 매입 가져오기",
    });

    if (stockInError) {
      return { error: `${item.name}: ${stockInError.message}`, success: null };
    }
  }

  revalidatePath("/products");
  revalidatePath("/stock-in");
  revalidatePath("/dashboard");
  return { error: null, success: `${items.length}개 상품이 입고 처리되었습니다.` };
}
