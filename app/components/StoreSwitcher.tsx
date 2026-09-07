"use client";

import { useEffect, useRef, useState } from "react";
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
  // select를 defaultValue(비제어)로 두면 최초 렌더 이후 currentStoreId가 바뀌어도
  // (예: 매장 추가로 자동 전환, 다른 곳에서 매장이 바뀐 경우) select의 실제 DOM 값은
  // 갱신되지 않고 그대로 남아있는다 — 그 상태에서 화면에 남아있던(사실은 이미 선택된)
  // 옵션을 다시 고르면 브라우저 입장에서 값이 안 바뀌어 onChange 자체가 발생하지 않고
  // 완전히 무반응으로 보인다. value로 제어하고 currentStoreId 변경에 맞춰 동기화한다.
  const [value, setValue] = useState(currentStoreId ?? "");
  useEffect(() => {
    setValue(currentStoreId ?? "");
  }, [currentStoreId]);

  return (
    <div className="flex flex-col gap-2 px-2 text-sm">
      {stores.length > 0 && (
        <form action={switchStore} className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">매장</span>
          <select
            name="store_id"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              e.currentTarget.form?.requestSubmit();
            }}
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
            className="rounded bg-[#C8075F] px-2 py-1 text-white hover:bg-[#a80650]"
          >
            추가
          </button>
        </form>
      </details>
    </div>
  );
}
