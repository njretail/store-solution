import { requireAdmin } from "@/lib/session";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import CategoryCreateForm from "./CategoryCreateForm";
import CategoryRow from "./CategoryRow";

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();

  const [{ data: categories }, products] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    // 상품이 매장 전체 1000개를 넘을 수 있어(fetch-all-pages 참고) range로 전부 가져온다.
    fetchAllPages<{ category_id: string | null }>((from, to) =>
      supabase.from("products").select("category_id").range(from, to)
    ),
  ]);

  const countByCategory = new Map<string, number>();
  for (const p of products) {
    if (!p.category_id) continue;
    countByCategory.set(p.category_id, (countByCategory.get(p.category_id) ?? 0) + 1);
  }

  const rows = categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">카테고리 관리</h1>
        <p className="text-sm text-zinc-500">
          카테고리는 모든 매장이 함께 쓰는 공용 분류예요. 이름을 바꾸면 그 카테고리를 쓰는
          모든 매장의 상품에 바로 반영됩니다.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <CategoryCreateForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">사용중인 상품</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                initialName={c.name}
                productCount={countByCategory.get(c.id) ?? 0}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                  등록된 카테고리가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
