import { requireProfile, getCurrentStore } from "@/lib/session";
import { createCamera, updateCamera, deleteCamera } from "./actions";
import type { Camera } from "@/lib/types";

export default async function CamerasPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("cameras")
    .select("*")
    .eq("store_id", store.id)
    .order("name");

  const cameras = (data ?? []) as Camera[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">카메라보기</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      {isAdmin && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            + 카메라 등록
          </summary>
          <form action={createCamera} className="mt-3 flex flex-wrap gap-2">
            <input
              name="name"
              placeholder="카메라 이름 (예: 카운터, 매장입구)"
              required
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              name="stream_url"
              placeholder="웹 공유/스트림 링크 (선택, 나중에 추가 가능)"
              className="flex-[2] rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              등록
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            사용 중인 카메라 앱/CCTV의 &ldquo;웹에서 보기&rdquo; 또는
            &ldquo;공유&rdquo; 링크가 있으면 붙여넣으세요. 없으면 이름만
            등록해두고 나중에 추가할 수 있어요.
          </p>
        </details>
      )}

      {cameras.length === 0 ? (
        <p className="text-sm text-zinc-400">등록된 카메라가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cameras.map((cam) => {
            const formId = `edit-${cam.id}`;
            return (
              <div
                key={cam.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900">{cam.name}</p>
                  {cam.stream_url && (
                    <a
                      href={cam.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C8075F] underline"
                    >
                      새 창에서 보기
                    </a>
                  )}
                </div>

                {cam.stream_url ? (
                  <iframe
                    src={cam.stream_url}
                    className="aspect-video w-full rounded border border-zinc-200"
                    allow="autoplay; encrypted-media"
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-300 bg-zinc-50 text-center">
                    <p className="text-sm text-zinc-500">연결된 링크가 없습니다.</p>
                    <p className="text-xs text-zinc-400">
                      화면이 안 보이면 카메라 앱의 공유 링크를 확인해주세요.
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <input
                      form={formId}
                      name="stream_url"
                      defaultValue={cam.stream_url ?? ""}
                      placeholder="웹 공유/스트림 링크"
                      className="flex-1 rounded border border-zinc-200 px-2 py-1 text-sm"
                    />
                    <input type="hidden" form={formId} name="id" value={cam.id} />
                    <input type="hidden" form={formId} name="name" value={cam.name} />
                    <button
                      type="submit"
                      form={formId}
                      className="text-sm text-zinc-600 hover:text-zinc-900"
                    >
                      저장
                    </button>
                    <form action={deleteCamera}>
                      <input type="hidden" name="id" value={cam.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cameras.map((cam) => (
        <form
          key={cam.id}
          id={`edit-${cam.id}`}
          action={updateCamera}
          className="hidden"
        />
      ))}
    </div>
  );
}
