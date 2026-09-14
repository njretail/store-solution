"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 px-2 text-sm">
      {stores.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">매장</span>
          {/* defaultValue를 쓰면 매장이 서버에서(예: 새 매장 추가 시 자동 전환) 바뀌어도
              이미 마운트된 select가 갱신되지 않아 실제 선택과 다르게 보이는 문제가 있었다.
              value로 항상 서버가 내려준 실제 현재 매장을 그대로 반영하게 한다.
              전환 자체도 form action의 암묵적 새로고침에만 기대지 않고, 액션이 끝난 뒤
              router.refresh()를 직접 호출해 화면이 확실히 갱신되게 한다 — 안 그러면
              쿠키는 바뀌었는데 헤더/목록은 새로고침 전까지 예전 매장을 계속 보여줬다. */}
          <select
            name="store_id"
            value={currentStoreId ?? ""}
            onChange={(e) => {
              const storeId = e.target.value;
              const formData = new FormData();
              formData.set("store_id", storeId);
              startTransition(() => {
                switchStore(formData).then(() => router.refresh());
              });
            }}
            className="w-full rounded-md border border-zinc-300 px-2 py-1"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <details ref={detailsRef} className="relative">
        <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-2 py-1 text-center text-zinc-600 hover:bg-zinc-50">
          + 새 매장
        </summary>
        <form
          action={async (formData) => {
            await addStore(formData);
            detailsRef.current?.removeAttribute("open");
            router.refresh();
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
