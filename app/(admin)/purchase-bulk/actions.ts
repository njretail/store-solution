"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { parseBulkRows, type ParsedRow } from "@/lib/coupang-parser";
import { fetchAllPages } from "@/lib/fetch-all-pages";

export type ParseState = { error: string | null; rows: ParsedRow[] };

export async function parseBulkExcel(
  _prevState: ParseState,
  formData: FormData
): Promise<ParseState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", rows: [] };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "엑셀 파일을 선택하세요.", rows: [] };
  }

  const marginPercent =
    Number(formData.get("margin_percent")) || store.default_margin_percent;

  let rawRows: unknown[][];
  try {
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  } catch {
    return { error: "엑셀 파일을 읽을 수 없습니다. 파일을 확인해주세요.", rows: [] };
  }

  const rows = parseBulkRows(rawRows, marginPercent);
  if (rows.length === 0) {
    return {
      error: "표를 인식하지 못했습니다. 바코드번호/상품명/수량/거래액 컬럼이 있는지 확인해주세요.",
      rows: [],
    };
  }

  const products = await fetchAllPages<{ id: string; name: string; barcode: string }>(
    (from, to) =>
      supabase
        .from("products")
        .select("id, name, barcode")
        .eq("store_id", store.id)
        .range(from, to)
  );
  const byBarcode = new Map(products.map((p) => [p.barcode.trim(), p]));

  const matchedRows: ParsedRow[] = rows.map((r) => {
    const matched = r.barcode ? byBarcode.get(r.barcode) : undefined;
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

export type PriceChange = {
  name: string;
  barcode: string;
  oldCostPrice: number;
  newCostPrice: number;
  oldSellPrice: number;
  newSellPrice: number;
};

export type ConfirmState = {
  error: string | null;
  success: string | null;
  priceChanges: PriceChange[];
};

// PurchaseImportForm(대량매입 화면)이 파싱된 행을 최종 확정할 때 호출한다.
// 이전에는 매입 등록(쿠팡) 화면과 공유하던 로직인데, 그 화면이 삭제되면서 여기로 옮겨왔다.
export async function confirmPurchaseImport(
  _prevState: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return { error: "매장을 먼저 선택하세요.", success: null, priceChanges: [] };

  let items: ConfirmItem[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "등록할 항목 정보가 올바르지 않습니다.", success: null, priceChanges: [] };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "등록할 항목이 없습니다.", success: null, priceChanges: [] };
  }

  const priceChanges: PriceChange[] = [];

  for (const item of items) {
    let productId = item.product_id;

    if (item.mode === "new") {
      if (!item.barcode) {
        return { error: `${item.name}: 바코드를 입력하세요.`, success: null, priceChanges: [] };
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
        return { error: message, success: null, priceChanges: [] };
      }
      productId = created.id;
    }

    if (!productId) {
      return { error: `${item.name}: 매칭할 상품을 선택하세요.`, success: null, priceChanges: [] };
    }

    // 기존 상품이면 매입가/판매가도 이번에 올린 자료 기준 최신값으로 갱신하고,
    // 기존 가격과 달라진 경우 나중에 화면/엑셀로 보여줄 수 있도록 기록해둔다.
    if (item.mode === "existing") {
      const { data: current } = await supabase
        .from("products")
        .select("name, barcode, cost_price, sell_price")
        .eq("id", productId)
        .single();

      if (current) {
        if (current.cost_price !== item.cost_price || current.sell_price !== item.sell_price) {
          priceChanges.push({
            name: current.name,
            barcode: current.barcode,
            oldCostPrice: current.cost_price,
            newCostPrice: item.cost_price,
            oldSellPrice: current.sell_price,
            newSellPrice: item.sell_price,
          });
        }

        const { error: updateError } = await supabase
          .from("products")
          .update({ cost_price: item.cost_price, sell_price: item.sell_price })
          .eq("id", productId);

        if (updateError) {
          return { error: `${item.name}: ${updateError.message}`, success: null, priceChanges: [] };
        }
      }
    }

    const { error: stockInError } = await supabase.rpc("record_stock_in", {
      p_product_id: productId,
      p_quantity: item.quantity,
      p_unit_cost: item.cost_price,
      p_memo: "매입 등록",
    });

    if (stockInError) {
      return { error: `${item.name}: ${stockInError.message}`, success: null, priceChanges: [] };
    }
  }

  revalidatePath("/products");
  revalidatePath("/stock-in");
  revalidatePath("/dashboard");
  return {
    error: null,
    success: `${items.length}개 상품이 입고 처리되었습니다.`,
    priceChanges,
  };
}
