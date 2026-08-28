"use server";

import * as XLSX from "xlsx";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { parseBulkRows, type ParsedRow } from "@/lib/coupang-parser";
import type { ParseState } from "../purchase-import/actions";

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

  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, barcode")
    .eq("store_id", store.id);
  const products = productsData ?? [];
  const byBarcode = new Map(products.map((p) => [p.barcode, p]));

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
