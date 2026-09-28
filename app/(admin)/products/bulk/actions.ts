"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, getAccessibleStores } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { parseProductRows, MAX_BULK_PRODUCTS, type BulkProductRow } from "@/lib/product-bulk-parser";

export type StoreImpact = {
  storeId: string;
  storeName: string;
  newCount: number;
  existingCount: number;
};

export type BulkParseState = {
  error: string | null;
  rows: BulkProductRow[];
  errors: string[];
  skippedDuplicates: number;
  impact: StoreImpact[];
  storeIds: string[];
};

const emptyParse: BulkParseState = {
  error: null,
  rows: [],
  errors: [],
  skippedDuplicates: 0,
  impact: [],
  storeIds: [],
};

async function existingBarcodes(supabase: SupabaseClient, storeId: string): Promise<Set<string>> {
  // 상품이 1000개를 넘는 매장이 있어 range로 전부 가져온다(fetch-all-pages 참고).
  const rows = await fetchAllPages<{ barcode: string }>((from, to) =>
    supabase.from("products").select("barcode").eq("store_id", storeId).order("id").range(from, to)
  );
  return new Set(rows.map((r) => r.barcode.trim()));
}

export async function parseProductExcel(
  _prevState: BulkParseState,
  formData: FormData
): Promise<BulkParseState> {
  const { supabase } = await requireAdmin();

  const requestedIds = formData.getAll("store_ids").map(String);
  const stores = (await getAccessibleStores(supabase)).filter((s) => requestedIds.includes(s.id));
  if (stores.length === 0) return { ...emptyParse, error: "적용할 매장을 하나 이상 선택하세요." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...emptyParse, error: "엑셀 파일을 선택하세요." };
  }

  let rawRows: unknown[][];
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  } catch {
    return { ...emptyParse, error: "엑셀 파일을 읽을 수 없습니다. 파일을 확인해주세요." };
  }

  const parsed = parseProductRows(rawRows);
  if (parsed.rows.length === 0) {
    return {
      ...emptyParse,
      error: parsed.errors[0] ?? "등록할 상품 행을 찾지 못했습니다.",
      errors: parsed.errors.slice(1),
    };
  }

  const impact: StoreImpact[] = [];
  for (const store of stores) {
    const existing = await existingBarcodes(supabase, store.id);
    const existingCount = parsed.rows.filter((r) => existing.has(r.barcode)).length;
    impact.push({
      storeId: store.id,
      storeName: store.name,
      newCount: parsed.rows.length - existingCount,
      existingCount,
    });
  }

  return {
    error: null,
    rows: parsed.rows,
    errors: parsed.errors,
    skippedDuplicates: parsed.skippedDuplicates,
    impact,
    storeIds: stores.map((s) => s.id).sort(),
  };
}

export type BulkRegisterState = { error: string | null; success: string[] | null };

function sanitizeRows(input: unknown): BulkProductRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_BULK_PRODUCTS) return null;
  const out: BulkProductRow[] = [];
  for (const r of input as Array<Record<string, unknown>>) {
    const barcode = String(r.barcode ?? "").trim();
    const name = String(r.name ?? "").trim();
    const sell = Number(r.sell_price);
    if (!barcode || !name || !Number.isFinite(sell) || sell <= 0) return null;
    const cost = r.cost_price == null ? null : Number(r.cost_price);
    const threshold = r.low_stock_threshold == null ? null : Number(r.low_stock_threshold);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return null;
    if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) return null;
    const category = String(r.category ?? "").trim();
    out.push({
      barcode,
      name,
      category: category || null,
      sell_price: Math.round(sell),
      cost_price: cost === null ? null : Math.round(cost),
      is_tax_exempt: typeof r.is_tax_exempt === "boolean" ? r.is_tax_exempt : null,
      low_stock_threshold: threshold === null ? null : Math.round(threshold),
    });
  }
  return out;
}

export async function registerProducts(
  _prevState: BulkRegisterState,
  formData: FormData
): Promise<BulkRegisterState> {
  const { supabase } = await requireAdmin();

  let parsedInput: unknown;
  try {
    parsedInput = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "등록할 상품 정보가 올바르지 않습니다.", success: null };
  }
  const rows = sanitizeRows(parsedInput);
  if (!rows) return { error: "등록할 상품 정보가 올바르지 않습니다.", success: null };

  const mode = formData.get("mode") === "update" ? "update" : "skip";
  const requestedIds = formData.getAll("store_ids").map(String);
  const stores = (await getAccessibleStores(supabase)).filter((s) => requestedIds.includes(s.id));
  if (stores.length === 0) return { error: "적용할 매장을 하나 이상 선택하세요.", success: null };

  // 카테고리는 모든 매장이 함께 쓰는 공용 목록 — 엑셀에 있는데 없는 이름만 새로 만든다.
  const names = [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))];
  const categoryIds = new Map<string, string>();
  if (names.length > 0) {
    const { data: existingCats } = await supabase.from("categories").select("id, name");
    for (const c of existingCats ?? []) categoryIds.set(c.name, c.id);

    const missing = names.filter((n) => !categoryIds.has(n));
    if (missing.length > 0) {
      const { error: catError } = await supabase.from("categories").insert(missing.map((name) => ({ name })));
      if (catError) return { error: `카테고리 생성 실패: ${catError.message}`, success: null };
      const { data: refreshed } = await supabase.from("categories").select("id, name");
      for (const c of refreshed ?? []) categoryIds.set(c.name, c.id);
    }
  }

  const now = new Date().toISOString();
  const lines: string[] = [];

  for (const store of stores) {
    const existing = await existingBarcodes(supabase, store.id);

    // 엑셀에 값이 없는 컬럼은 payload에서 빼서(기존 상품 갱신 시 기존 값을 지우지 않게),
    // 같은 컬럼 구성끼리 묶어서 upsert한다. stock_qty는 아예 다루지 않는다(신규는 0으로 시작).
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const payload: Record<string, unknown> = {
        store_id: store.id,
        barcode: r.barcode,
        name: r.name,
        sell_price: r.sell_price,
        updated_at: now,
      };
      if (r.category) payload.category_id = categoryIds.get(r.category) ?? null;
      if (r.cost_price !== null) payload.cost_price = r.cost_price;
      if (r.is_tax_exempt !== null) payload.is_tax_exempt = r.is_tax_exempt;
      if (r.low_stock_threshold !== null) payload.low_stock_threshold = r.low_stock_threshold;

      const signature = Object.keys(payload).sort().join(",");
      const list = groups.get(signature) ?? [];
      list.push(payload);
      groups.set(signature, list);
    }

    for (const list of groups.values()) {
      for (let i = 0; i < list.length; i += 500) {
        const { error } = await supabase
          .from("products")
          .upsert(list.slice(i, i + 500), {
            onConflict: "store_id,barcode",
            ignoreDuplicates: mode === "skip",
          });
        if (error) return { error: `${store.name}: ${error.message}`, success: lines };
      }
    }

    const existingCount = rows.filter((r) => existing.has(r.barcode)).length;
    const newCount = rows.length - existingCount;
    lines.push(
      mode === "update"
        ? `${store.name}: 신규 ${newCount}개 등록, 기존 ${existingCount}개 정보 갱신`
        : `${store.name}: 신규 ${newCount}개 등록, 기존 ${existingCount}개는 건너뜀`
    );
  }

  revalidatePath("/products");
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  return { error: null, success: lines };
}
