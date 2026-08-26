import { requireAdmin, getCurrentStore } from "@/lib/session";
import { createProduct, updateProduct, deleteProduct } from "./actions";
import type { Product } from "@/lib/types";

export default async function ProductsPage() {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .order("name");

  const products = (data ?? []) as Product[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">상품관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      <details className="rounded-lg border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">
          + 상품 추가
        </summary>
        <form
          action={createProduct}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input
            name="barcode"
            placeholder="바코드"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="name"
            placeholder="상품명"
            required
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="category"
            placeholder="분류 (선택)"
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="cost_price"
            type="number"
            placeholder="원가"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="sell_price"
            type="number"
            placeholder="판매가"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="stock_qty"
            type="number"
            placeholder="초기 재고"
            defaultValue={0}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <input
            name="low_stock_threshold"
            type="number"
            placeholder="재고부족 기준"
            defaultValue={5}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white sm:col-span-3"
          >
            등록
          </button>
        </form>
      </details>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">바코드</th>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">분류</th>
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
                    <input
                      form={formId}
                      name="category"
                      defaultValue={p.category ?? ""}
                      className="w-full rounded border border-zinc-200 px-2 py-1"
                    />
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
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">
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
