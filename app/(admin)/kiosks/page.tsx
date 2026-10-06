import { Fragment } from "react";
import Link from "next/link";
import { requireProfile, getCurrentStore } from "@/lib/session";
import {
  createKiosk,
  updateKioskStatus,
  updateKioskDisplay,
  deleteKiosk,
  sendKioskCommand,
  updateDailyRebootTime,
} from "./actions";
import { KIOSK_STATUS_LABELS } from "@/lib/types";
import type { Kiosk } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  online: "text-green-600",
  offline: "text-red-600",
  maintenance: "text-amber-600",
};

export default async function KiosksPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  const { data } = await supabase
    .from("kiosks")
    .select("*")
    .eq("store_id", store.id)
    .order("name");

  const kiosks = (data ?? []) as Kiosk[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">키오스크 관리</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>

      {isAdmin && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            + 키오스크 등록
          </summary>
          <form action={createKiosk} className="mt-3 flex gap-2">
            <input
              name="name"
              placeholder="키오스크 이름 (예: 카운터1)"
              required
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-3 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              등록
            </button>
          </form>
        </details>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-base">
          <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">마지막 갱신</th>
              {isAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {kiosks.map((k) => (
              <Fragment key={k.id}>
                <tr className="border-t border-zinc-100">
                  <td className="px-4 py-3">{k.name}</td>
                  <td className={`px-4 py-3 font-medium ${STATUS_COLORS[k.status]}`}>
                    {KIOSK_STATUS_LABELS[k.status]}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(k.updated_at).toLocaleString("ko-KR")}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <form action={updateKioskStatus} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={k.id} />
                          <select
                            name="status"
                            defaultValue={k.status}
                            className="rounded border border-zinc-200 px-2 py-1 text-sm"
                          >
                            <option value="online">정상</option>
                            <option value="maintenance">점검중</option>
                            <option value="offline">오프라인</option>
                          </select>
                          <button
                            type="submit"
                            className="text-sm text-zinc-600 hover:text-zinc-900"
                          >
                            변경
                          </button>
                        </form>
                        <Link
                          href={`/kiosk/${k.id}`}
                          target="_blank"
                          className="text-sm text-[#C8075F] underline"
                        >
                          화면 미리보기
                        </Link>
                        <form action={sendKioskCommand}>
                          <input type="hidden" name="id" value={k.id} />
                          <input type="hidden" name="command" value="refresh" />
                          <button type="submit" className="text-sm text-zinc-600 hover:text-zinc-900">
                            새로고침
                          </button>
                        </form>
                        <form action={deleteKiosk}>
                          <input type="hidden" name="id" value={k.id} />
                          <button
                            type="submit"
                            className="text-sm text-red-500 hover:text-red-700"
                          >
                            삭제
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
                {isAdmin && (
                  <tr className="border-t border-zinc-100 bg-zinc-50/50">
                    <td colSpan={4} className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                          화면 문구 설정 (실제 키오스크 화면이 붙으면 여기 값을 그대로 보여줘요)
                        </summary>
                        <form action={updateKioskDisplay} className="mt-2 flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={k.id} />
                          <input
                            name="banner_message"
                            defaultValue={k.banner_message ?? ""}
                            placeholder="상단 배너 문구 (예: 오늘 아이스크림 1+1)"
                            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                          />
                          <input
                            name="notice_message"
                            defaultValue={k.notice_message ?? ""}
                            placeholder="안내 멘트 (예: 봉투는 별도 구매입니다)"
                            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white"
                          >
                            저장
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                )}
                {isAdmin && (
                  <tr className="border-t border-zinc-100 bg-zinc-50/50">
                    <td colSpan={4} className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                          기기 전원 관리 (PC에 kiosk-agent가 설치돼 있어야 실제로 동작해요)
                        </summary>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <form action={sendKioskCommand}>
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="command" value="restart_program" />
                            <button
                              type="submit"
                              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white"
                            >
                              프로그램 재시작
                            </button>
                          </form>
                          <form action={sendKioskCommand}>
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="command" value="restart_device" />
                            <button
                              type="submit"
                              className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
                            >
                              기기 재시작
                            </button>
                          </form>
                          <form
                            action={sendKioskCommand}
                            onSubmit={(e) => {
                              if (!confirm(`"${k.name}" 기기를 종료할까요? 매장에 직접 가야 다시 켤 수 있어요.`)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="command" value="shutdown_device" />
                            <button
                              type="submit"
                              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                            >
                              기기 종료
                            </button>
                          </form>
                        </div>
                        <form action={updateDailyRebootTime} className="mt-3 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={k.id} />
                          <label className="text-xs text-zinc-500">매일 자동 재부팅 시각</label>
                          <input
                            type="time"
                            name="daily_reboot_time"
                            defaultValue={k.daily_reboot_time ?? ""}
                            className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white"
                          >
                            저장
                          </button>
                          <span className="text-xs text-zinc-400">비워두면 자동 재부팅 안 함</span>
                        </form>
                      </details>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {kiosks.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-4 py-6 text-center text-zinc-400"
                >
                  등록된 키오스크가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-400">
        “화면 미리보기”가 실제 구매자 화면(/kiosk/[id])이에요 — 이 주소를 키오스크
        하드웨어의 브라우저가 전체화면으로 띄우면 그대로 매장에 쓸 수 있습니다.
        “새로고침”은 그 화면 자체가 처리하지만, “기기 전원 관리”의 나머지 명령(프로그램
        재시작/기기 재시작/종료/매일 자동 재부팅)은 브라우저가 할 수 없는 영역이라
        키오스크 PC(Windows)에 <span className="font-mono text-xs">kiosk-agent</span>
        (저장소의 kiosk-agent 폴더, PowerShell 스크립트)를 설치해둬야 실제로 동작합니다.
      </p>
    </div>
  );
}
