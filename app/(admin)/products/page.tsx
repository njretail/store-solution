import Link from "next/link";
import { requireAdmin, getCurrentStore } from "@/lib/session";
import { updateProduct, deleteProduct } from "./actions";
import type { Category, Product } from "@/lib/types";

export default async function ProductsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const [{ data: productsData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("store_id", store.id)
      .order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  const products = (productsData ?? []) as Product[];
  const categories = (categoriesData ?? []) as Category[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">상품 조회</h1>
          <p className="text-sm text-zinc-500">{store.name}</p>
        </div>
        <Link
          href="/products/new"
          className="rounded bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650]"
        >
          + 상품 추가
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-3 py-2">바코드</th>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">분류</th>
              <th className="px-3 py-2">과세</th>
              <th className="px-3 py-2">원가</th>
              <th className="px-3 py-2">판매가</th>
              <th className="px-3 py-2">재고</th>
              <th className="px-3 py-2">재고부족 기준</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const formId = `edit-${p.id}`;
              const lowStock = p.stock_qty <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-500">{p.barcode}</td>
                  <td className="px-2 py-1">
                    <input
                      form={formId}
                      name="name"
                      defaultValue={p.name}
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      form={formId}
                      name="category_id"
                      defaultValue={p.category_id ?? ""}
                      className="rounded border border-zinc-200 px-2 py-1"
                    >
                      <option value="">분류 없음</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      form={formId}
                      name="is_tax_exempt"
                      defaultValue={String(p.is_tax_exempt)}
                      className="rounded border border-zinc-200 px-2 py-1"
                    >
                      <option value="false">과세</option>
                      <option value="true">면세</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      form={formId}
                      name="cost_price"
                      type="number"
                      defaultValue={p.cost_price}
                      className="w-24 rounded border border-zinc-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      form={formId}
                      name="sell_price"
                      type="number"
                      defaultValue={p.sell_price}
                      className="w-24 rounded border border-zinc-200 px-2 py-1"
                    />
                  </td>
                  <td
                    className={`px-3 py-2 ${lowStock ? "font-medium text-red-600" : "text-zinc-700"}`}
                  >
                    {p.stock_qty}
                    {lowStock && " ⚠"}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      form={formId}
                      name="low_stock_threshold"
                      type="number"
                      defaultValue={p.low_stock_threshold}
                      className="w-20 rounded border border-zinc-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      <input type="hidden" form={formId} name="id" value={p.id} />
                      <button
                        type="submit"
                        form={formId}
                        className="text-zinc-600 hover:text-zinc-900"
                      >
                        저장
                      </button>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-400">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {products.map((p) => (
        <form
          key={p.id}
          id={`edit-${p.id}`}
          action={updateProduct}
          className="hidden"
        />
      ))}
    </div>
  );
}
