"use client";

import { useRef } from "react";
import { switchStore, addStore } from "@/lib/actions";
import type { Store } from "@/lib/types";

export default function StoreSwitcher({
  stores,
  currentStoreId,
}: {
  stores: Store[];
  currentStoreId: string | null;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <div className="flex flex-col gap-2 px-2 text-sm">
      {stores.length > 0 && (
        <form action={switchStore} className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">매장</span>
          <select
            name="store_id"
            defaultValue={currentStoreId ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full rounded-md border border-zinc-300 px-2 py-1"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </form>
      )}

      <details ref={detailsRef} className="relative">
        <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-2 py-1 text-center text-zinc-600 hover:bg-zinc-50">
          + 새 매장
        </summary>
        <form
          action={async (formData) => {
            await addStore(formData);
            detailsRef.current?.removeAttribute("open");
          }}
          className="absolute bottom-full left-0 z-10 mb-2 flex w-56 flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 shadow-md"
        >
          <input
            name="name"
            placeholder="매장명"
            required
            className="rounded border border-zinc-300 px-2 py-1"
          />
          <input
            name="address"
            placeholder="주소 (선택)"
            className="rounded border border-zinc-300 px-2 py-1"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-2 py-1 text-white"
          >
            추가
          </button>
        </form>
      </details>
    </div>
  );
}
