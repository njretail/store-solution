import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import LowStockSection from "./LowStockSection";
import SelectAllCheckbox from "./SelectAllCheckbox";
import CategorySelectAllCheckbox from "./CategorySelectAllCheckbox";
import ProductOrderCell from "./ProductOrderCell";
import { syncAutoOrderEnabled } from "./actions";
import { buildGradeMap, GRADE_STYLE, type Grade } from "./grade";

const PRODUCTS_AUTO_ORDER_FORM_ID = "products-auto-order-form";

const SEARCH_LIMIT = 200;

type SortKey = "name" | "sell_price" | "cost_price" | "stock_qty" | "low_stock_threshold";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "상품명" },
  { key: "sell_price", label: "판매가" },
  { key: "cost_price", label: "입고가" },
  { key: "stock_qty", label: "재고" },
  { key: "low_stock_threshold", label: "적정재고" },
];

function isSortKey(v: string | undefined): v is SortKey {
  return v === "name" || v === "sell_price" || v === "cost_price" || v === "stock_qty" || v === "low_stock_threshold";
}

type Row = {
  id: string;
  barcode: string;
  name: string;
  sell_price: number;
  cost_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  category: string | null;
  auto_order_enabled: boolean;
  grade: Grade | null;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; sort?: string; dir?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const isLowStockView = params.view === "low-stock";
  const sort: SortKey = isSortKey(params.sort) ? params.sort : "name";
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";

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
    "id, barcode, name, sell_price, cost_price, stock_qty, low_stock_threshold, auto_order_enabled, categories(name)";
  type ProductRow = {
    id: string;
    barcode: string;
    name: string;
    sell_price: number;
    cost_price: number;
    stock_qty: number;
    low_stock_threshold: number;
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

  // 최근 30일 매출금액 기준 ABC 등급 — 표에 표시용.
  const gradeMap = buildGradeMap((rankData ?? []) as Array<{ product_id: string; revenue: number }>);

  const dirMul = dir === "asc" ? 1 : -1;
  const rows: Row[] = (data ?? [])
    .map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      sell_price: p.sell_price,
      cost_price: p.cost_price,
      stock_qty: p.stock_qty,
      low_stock_threshold: p.low_stock_threshold,
      auto_order_enabled: p.auto_order_enabled,
      category: p.categories?.name ?? null,
      grade: gradeMap.get(p.id) ?? null,
    }))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ko") * dirMul;
      return (a[sort] - b[sort]) * dirMul;
    });

  const total = count ?? rows.length;

  // 카테고리별로 묶는다 (검색 중이 아닐 때만 — 검색 결과는 평평한 목록으로 보여준다).
  // 정렬은 이미 위에서 끝나 있어 그룹으로 나눠도 각 그룹 내부 순서가 그대로 유지된다.
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

  function sortHref(key: SortKey) {
    const nextDir: SortDir = sort === key && dir === "asc" ? "desc" : "asc";
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("sort", key);
    sp.set("dir", nextDir);
    return `/products?${sp.toString()}`;
  }

  function SortableHeader({ column }: { column: SortKey }) {
    const label = SORT_COLUMNS.find((c) => c.key === column)!.label;
    const active = sort === column;
    return (
      <Link href={sortHref(column)} className={`inline-flex items-center gap-0.5 hover:underline ${active ? "text-[#C8075F]" : ""}`}>
        {label}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    );
  }

  function ProductTable({ items }: { items: Row[] }) {
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[1260px] table-fixed whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="w-[70px] px-4 py-3">등급</th>
              <th className="w-[260px] px-4 py-3">
                <SortableHeader column="name" />
              </th>
              <th className="w-[110px] px-4 py-3">
                <SortableHeader column="sell_price" />
              </th>
              <th className="w-[110px] px-4 py-3">
                <SortableHeader column="cost_price" />
              </th>
              <th className="w-[90px] px-4 py-3">
                <SortableHeader column="stock_qty" />
              </th>
              <th className="w-[100px] px-4 py-3">
                <SortableHeader column="low_stock_threshold" />
              </th>
              <th className="w-[110px] px-4 py-3">자동발주</th>
              <th className="w-[420px] px-4 py-3">발주</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const lowStock = p.stock_qty <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    {p.grade ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${GRADE_STYLE[p.grade]}`}>
                        {p.grade}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-zinc-400">{p.barcode}</div>
                    <Link href={`/products/${p.id}`} className="truncate hover:text-[#C8075F] hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.sell_price.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-zinc-500">{p.cost_price.toLocaleString()}원</td>
                  <td className={`px-4 py-3 font-medium ${lowStock ? "text-red-600" : "text-zinc-900"}`}>
                    {p.stock_qty}
                    {lowStock && " ⚠"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.low_stock_threshold}</td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    <ProductOrderCell
                      productId={p.id}
                      productName={p.name}
                      lowStockThreshold={p.low_stock_threshold}
                    />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                  상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

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
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
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

      <p className="text-xs text-zinc-400">
        표 머리글(상품명/판매가/입고가/재고/적정재고)을 클릭하면 그 기준으로 정렬돼요.
        발주 칸에 수량을 입력하고 엔터를 누르면 바로 본부로 발주가 들어가요.
      </p>

      {/* 체크박스는 표 안에, form 태그는 밖에 두고 form={PRODUCTS_AUTO_ORDER_FORM_ID}로
          연결한다 — ProductOrderCell이 행마다 자체 <form>(본부/쿠팡 발주)을 갖고 있어서
          표 전체를 <form>으로 감싸면 form 중첩(잘못된 HTML)이 되기 때문. */}
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
          <ProductTable items={rows} />
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
                <span className="flex items-center gap-2">
                  <CategorySelectAllCheckbox />
                  {category}
                </span>
                <span className="text-zinc-400">{items.length}개</span>
              </summary>
              <div className="border-t border-zinc-100 p-3">
                <ProductTable items={items} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
