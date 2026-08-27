import Link from "next/link";
import Image from "next/image";
import { requireAdmin, getCurrentStore } from "@/lib/session";

const SEARCH_LIMIT = 200;

type Row = {
  id: string;
  barcode: string;
  name: string;
  sell_price: number;
  cost_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  image_url: string | null;
  category: string | null;
};

function ProductCard({ p }: { p: Row }) {
  const lowStock = p.stock_qty <= p.low_stock_threshold;
  return (
    <Link
      href={`/products/${p.id}`}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-[#C8075F]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
        {p.image_url ? (
          <Image
            src={p.image_url}
            alt={p.name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-xs text-zinc-300">사진 없음</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
        <p className="truncate text-xs text-zinc-400">{p.barcode}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="text-zinc-700">판매가 {p.sell_price.toLocaleString()}원</span>
          <span className="text-zinc-500">입고가 {p.cost_price.toLocaleString()}원</span>
          <span className={lowStock ? "font-medium text-red-600" : "text-zinc-500"}>
            재고 {p.stock_qty}개{lowStock && " ⚠"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  let query = supabase
    .from("products")
    .select(
      "id, barcode, name, sell_price, cost_price, stock_qty, low_stock_threshold, image_url, categories(name)",
      { count: "exact" }
    )
    .eq("store_id", store.id);
  if (q) {
    query = query.or(`name.ilike.%${q}%,barcode.ilike.%${q}%`).limit(SEARCH_LIMIT);
  }

  const { data, count } = await query.order("name");

  const rows: Row[] = (data ?? []).map((p) => ({
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    sell_price: p.sell_price,
    cost_price: p.cost_price,
    stock_qty: p.stock_qty,
    low_stock_threshold: p.low_stock_threshold,
    image_url: p.image_url,
    category: (p.categories as unknown as { name: string } | null)?.name ?? null,
  }));

  const total = count ?? rows.length;

  // 카테고리별로 묶는다 (검색 중이 아닐 때만 — 검색 결과는 평평한 목록으로 보여준다).
  const grouped = new Map<string, Row[]>();
  if (!q) {
    for (const r of rows) {
      const key = r.category ?? "미분류";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }
  }
  const groupEntries = [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ko")
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            상품 조회 ({total.toLocaleString()}개)
          </h1>
          <p className="text-sm text-zinc-500">{store.name}</p>
        </div>
        <Link
          href="/products/new"
          className="rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650]"
        >
          + 상품 추가
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="상품명 또는 바코드로 검색"
          className="w-full max-w-sm rounded border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          검색
        </button>
        {q && (
          <Link
            href="/products"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
          >
            초기화
          </Link>
        )}
      </form>

      {q ? (
        <div className="flex flex-col gap-2">
          {rows.length === SEARCH_LIMIT && (
            <p className="text-sm text-amber-600">
              검색 결과가 많아 상위 {SEARCH_LIMIT}개만 표시했어요. 검색어를 더
              구체적으로 입력해주세요.
            </p>
          )}
          {rows.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
          {rows.length === 0 && (
            <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
              검색 결과가 없습니다.
            </p>
          )}
        </div>
      ) : groupEntries.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
          등록된 상품이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groupEntries.map(([category, items]) => (
            <details
              key={category}
              className="rounded-lg border border-zinc-200 bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700">
                <span>{category}</span>
                <span className="text-zinc-400">{items.length}개</span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-zinc-100 p-3">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
