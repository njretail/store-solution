import { requireProfile } from "@/lib/session";
import { deleteAnnouncement } from "./actions";
import AnnouncementForm from "./AnnouncementForm";
import type { Announcement } from "@/lib/types";

export default async function AnnouncementsPage() {
  const { supabase, profile } = await requireProfile();

  const { data } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const announcements = (data ?? []) as Announcement[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">공지사항</h1>
        <p className="text-sm text-zinc-500">모든 매장의 관리자·직원에게 공통으로 보이는 공지입니다.</p>
      </div>

      {profile.role === "admin" && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <AnnouncementForm />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-medium text-zinc-900">{a.title}</h2>
              {profile.role === "admin" && (
                <form action={deleteAnnouncement}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="shrink-0 text-xs text-red-500 hover:text-red-700">
                    삭제
                  </button>
                </form>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{a.body}</p>
            <p className="mt-2 text-xs text-zinc-400">
              {new Date(a.created_at).toLocaleString("ko-KR")}
            </p>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-zinc-400">
            등록된 공지사항이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
