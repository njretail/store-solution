import Link from "next/link";
import Image from "next/image";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import LowStockSection from "./LowStockSection";
import SelectAllCheckbox from "./SelectAllCheckbox";
import { syncAutoOrderEnabled } from "./actions";
import { buildGradeMap, GRADE_STYLE, type Grade } from "./grade";

const PRODUCTS_AUTO_ORDER_FORM_ID = "products-auto-order-form";

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
  auto_order_enabled: boolean;
  grade: Grade | null;
};

function ProductCard({ p }: { p: Row }) {
  const lowStock = p.stock_qty <= p.low_stock_threshold;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-[#C8075F]">
      <Link href={`/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
          <div className="flex items-center gap-1.5">
            {p.grade ? (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${GRADE_STYLE[p.grade]}`}>
                {p.grade}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-300">-</span>
            )}
            <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
          </div>
          <p className="truncate text-xs text-zinc-400">{p.barcode}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="text-zinc-700">판매가 {p.sell_price.toLocaleString()}원</span>
            <span className="text-zinc-500">입고가 {p.cost_price.toLocaleString()}원</span>
            <span className={lowStock ? "font-medium text-red-600" : "text-zinc-500"}>
              재고 {p.stock_qty}개{lowStock && " ⚠"}
            </span>
            <span className="text-zinc-400">적정재고 {p.low_stock_threshold}개</span>
          </div>
        </div>
      </Link>
      {/* 링크 밖에 둬서 체크박스 클릭이 상세페이지 이동으로 튀지 않게 한다. */}
      <label className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
        <input type="hidden" form={PRODUCTS_AUTO_ORDER_FORM_ID} name="row_ids" value={p.id} />
        <input
          type="checkbox"
          form={PRODUCTS_AUTO_ORDER_FORM_ID}
          name="checked_ids"
          value={p.id}
          defaultChecked={p.auto_order_enabled}
          data-auto-order-checkbox
          className="h-3.5 w-3.5 rounded border-zinc-300"
        />
        자동발주
      </label>
    </div>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const isLowStockView = params.view === "low-stock";

  const ViewToggle = (
    <Link
      href={isLowStockView ? "/products" : "/products?view=low-stock"}
      className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
    >
      {isLowStockView ? "전체 상품 보기" : "재고소진상품만 보기"}
    </Link>
  );

  if (isLowStockView) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">재고소진상품</h1>
            <p className="text-sm text-zinc-500">{store.name}</p>
          </div>
          {ViewToggle}
        </div>
        <LowStockSection supabase={supabase} store={store} />
      </div>
    );
  }

  const columns =
    "id, barcode, name, sell_price, cost_price, stock_qty, low_stock_threshold, image_url, auto_order_enabled, categories(name)";
  type ProductRow = {
    id: string;
    barcode: string;
    name: string;
    sell_price: number;
    cost_price: number;
    stock_qty: number;
    low_stock_threshold: number;
    image_url: string | null;
    auto_order_enabled: boolean;
    categories: { name: string } | null;
  };

  const rankFrom = new Date();
  rankFrom.setDate(rankFrom.getDate() - 30);

  let data: ProductRow[];
  let count: number | null;
  let rankData: unknown;
  if (q) {
    const [res, rank] = await Promise.all([
      supabase
        .from("products")
        .select(columns, { count: "exact" })
        .eq("store_id", store.id)
        .or(`name.ilike.%${q}%,barcode.ilike.%${q}%`)
        .order("name")
        .limit(SEARCH_LIMIT),
      supabase.rpc("top_products", {
        p_store_id: store.id,
        p_from: rankFrom.toISOString(),
        p_to: new Date().toISOString(),
        p_limit: 100000,
      }),
    ]);
    data = (res.data as unknown as ProductRow[]) ?? [];
    count = res.count;
    rankData = rank.data;
  } else {
    // 검색 중이 아닐 때는 전체 목록이 필요하므로, Supabase 기본 1000행 제한에 걸리지
    // 않도록 range()로 나눠서 전부 가져온다(상품이 1000개를 넘으면 뒤쪽이 누락되던 버그).
    const [fetched, rank] = await Promise.all([
      fetchAllPages<ProductRow>((from, to) =>
        supabase
          .from("products")
          .select(columns)
          .eq("store_id", store.id)
          .order("name")
          .range(from, to)
          .then((res) => ({ data: res.data as unknown as ProductRow[] | null, error: res.error }))
      ),
      supabase.rpc("top_products", {
        p_store_id: store.id,
        p_from: rankFrom.toISOString(),
        p_to: new Date().toISOString(),
        p_limit: 100000,
      }),
    ]);
    data = fetched;
    count = fetched.length;
    rankData = rank.data;
  }

  // 최근 30일 매출금액 기준 ABC 등급 — 상품 카드에 표시용.
  const gradeMap = buildGradeMap((rankData ?? []) as Array<{ product_id: string; revenue: number }>);

  const rows: Row[] = (data ?? [])
    .map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      sell_price: p.sell_price,
      cost_price: p.cost_price,
      stock_qty: p.stock_qty,
      low_stock_threshold: p.low_stock_threshold,
      image_url: p.image_url,
      auto_order_enabled: p.auto_order_enabled,
      category: p.categories?.name ?? null,
      grade: gradeMap.get(p.id) ?? null,
    }))
    // 재고 적은 순으로 정렬 — 뭐가 급한지 한눈에 보이도록.
    .sort((a, b) => a.stock_qty - b.stock_qty);

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
        <div className="flex items-center gap-2">
          {ViewToggle}
          <Link
            href="/products/new"
            className="rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650]"
          >
            + 상품 추가
          </Link>
        </div>
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

      {/* 체크박스는 카드 안에, form 태그는 밖에 두고 form={PRODUCTS_AUTO_ORDER_FORM_ID}로
          연결한다 — 카드 자체가 <Link>를 포함하고 있어 표 전체를 <form>으로 감싸면
          form 중첩(잘못된 HTML)이 되기 때문. */}
      <form id={PRODUCTS_AUTO_ORDER_FORM_ID} action={syncAutoOrderEnabled} />
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-zinc-500">
            <SelectAllCheckbox />
            자동발주 전체선택/해제
          </span>
          <button
            type="submit"
            form={PRODUCTS_AUTO_ORDER_FORM_ID}
            className="rounded-lg bg-[#C8075F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a80650]"
          >
            자동발주 설정 저장
          </button>
        </div>
      )}

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
