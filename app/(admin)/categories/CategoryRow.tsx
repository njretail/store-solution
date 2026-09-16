"use client";

import { useActionState, useState } from "react";
import { renameCategory, deleteCategory, type DeleteCategoryState } from "./actions";

const initialDeleteState: DeleteCategoryState = { error: null };

export default function CategoryRow({
  id,
  initialName,
  productCount,
}: {
  id: string;
  initialName: string;
  productCount: number;
}) {
  const [name, setName] = useState(initialName);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCategory, initialDeleteState);

  const changed = name.trim() !== initialName && name.trim().length > 0;

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="px-4 py-3">
        <form action={renameCategory} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          {changed && (
            <button type="submit" className="shrink-0 text-xs text-[#C8075F] underline">
              저장
            </button>
          )}
        </form>
      </td>
      <td className="px-4 py-3 text-zinc-500">{productCount.toLocaleString()}개</td>
      <td className="px-4 py-3">
        <form action={deleteAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={deletePending}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deletePending ? "삭제 중..." : "삭제"}
          </button>
        </form>
        {deleteState.error && <p className="mt-1 text-xs text-red-600">{deleteState.error}</p>}
      </td>
    </tr>
  );
}
