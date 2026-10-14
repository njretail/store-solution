import { Fragment } from "react";
import Link from "next/link";
import { requireProfile, getCurrentStore } from "@/lib/session";
import { createKiosk, updateKioskStatus, updateKioskDisplay, deleteKiosk, updateDailyRebootTime } from "./actions";
import KioskCommandButton from "./KioskCommandButton";
import { KIOSK_STATUS_LABELS } from "@/lib/types";
import type { Kiosk } from "@/lib/types";
import { OFFLINE_THRESHOLD_MINUTES, healthProblems } from "@/lib/kiosk-alerts";

const STATUS_COLORS: Record<string, string> = {
  online: "text-green-600",
  offline: "text-red-600",
  maintenance: "text-amber-600",
};

function minutesAgo(iso: string | null, now: number): number | null {
  return iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60000)) : null;
}

function agoLabel(min: number | null): string {
  if (min === null) return "신호 없음";
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / 60 / 24)}일 전`;
}

// 화면·에이전트 중 더 최근 신호 기준으로 연결 상태를 판단한다(5분 기준 — 응답 없음 알림과 동일).
function connection(k: Kiosk, now: number): { label: string; className: string } {
  const screen = minutesAgo(k.screen_last_seen_at, now);
  const agent = minutesAgo(k.agent_last_seen_at, now);
  const latest = [screen, agent].filter((v): v is number => v !== null);
  if (latest.length === 0) return { label: "신호 없음(미설치)", className: "bg-zinc-100 text-zinc-500" };
  const min = Math.min(...latest);
  if (min <= OFFLINE_THRESHOLD_MINUTES) return { label: "연결됨", className: "bg-green-100 text-green-700" };
  return { label: `응답 없음 · ${agoLabel(min)}`, className: "bg-red-100 text-red-700" };
}

const BTN = "rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white";

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
  // eslint-disable-next-line react-hooks/purity -- 요청마다 새로 렌더링되는 서버 컴포넌트라 현재 시각 기준 표시가 맞다
  const now = Date.now();

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
              <th className="px-4 py-3">운영 상태</th>
              <th className="px-4 py-3">연결</th>
              <th className="px-4 py-3">마지막 신호</th>
              {isAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {kiosks.map((k) => {
              const conn = connection(k, now);
              const health = k.last_health;
              const problems = health ? healthProblems(health) : [];
              return (
                <Fragment key={k.id}>
                  <tr className="border-t border-zinc-100">
                    <td className="px-4 py-3">{k.name}</td>
                    <td className={`px-4 py-3 font-medium ${STATUS_COLORS[k.status]}`}>
                      {KIOSK_STATUS_LABELS[k.status]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${conn.className}`}>{conn.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      <p>화면: {agoLabel(minutesAgo(k.screen_last_seen_at, now))}</p>
                      <p>에이전트: {agoLabel(minutesAgo(k.agent_last_seen_at, now))}</p>
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
                            <button type="submit" className="text-sm text-zinc-600 hover:text-zinc-900">
                              변경
                            </button>
                          </form>
                          <Link href={`/kiosk/${k.id}`} target="_blank" className="text-sm text-[#C8075F] underline">
                            화면 미리보기
                          </Link>
                          <KioskCommandButton
                            kioskId={k.id}
                            command="refresh"
                            label="새로고침"
                            className="text-sm text-zinc-600 hover:text-zinc-900"
                          />
                          <form action={deleteKiosk}>
                            <input type="hidden" name="id" value={k.id} />
                            <button type="submit" className="text-sm text-red-500 hover:text-red-700">
                              삭제
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isAdmin && (
                    <tr className="border-t border-zinc-100 bg-zinc-50/50">
                      <td colSpan={5} className="px-4 py-3">
                        <details open={conn.label.startsWith("응답 없음") || problems.length > 0}>
                          <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                            기기 상태·원격 관리 (PC에 kiosk-agent가 설치돼 있어야 상태 점검·재시작이 동작해요)
                          </summary>
                          <div className="mt-3 flex flex-col gap-3">
                            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-zinc-700">
                                  최근 상태 점검{" "}
                                  <span className="font-normal text-zinc-400">
                                    {k.last_health_at
                                      ? new Date(k.last_health_at).toLocaleString("ko-KR")
                                      : "아직 점검 결과가 없어요"}
                                  </span>
                                </p>
                                <KioskCommandButton
                                  kioskId={k.id}
                                  command="health_check"
                                  label="지금 상태 점검"
                                  className="rounded bg-[#C8075F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#a80650]"
                                />
                              </div>
                              {health ? (
                                <>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-zinc-600 sm:grid-cols-3">
                                    <span>화면(브라우저): {health.browser_running === false ? "꺼짐" : health.browser_running ? "실행 중" : "-"}</span>
                                    <span>서버 응답: {health.network_ms == null ? "실패" : `${health.network_ms}ms`}</span>
                                    <span>디스크 여유: {health.disk_free_gb ?? "-"}GB</span>
                                    <span>메모리 사용: {health.memory_used_percent ?? "-"}%</span>
                                    <span>CPU 사용: {health.cpu_percent ?? "-"}%</span>
                                    <span>켜진 지: {health.uptime_hours ?? "-"}시간</span>
                                  </div>
                                  {problems.length > 0 ? (
                                    <ul className="mt-2 rounded bg-red-50 px-3 py-2 text-red-700">
                                      {problems.map((p) => (
                                        <li key={p}>⚠ {p}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-green-700">✓ 이상 없음</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-zinc-400">
                                  “지금 상태 점검”을 누르면 30초 안에 kiosk-agent가 네트워크·디스크·메모리·화면 실행
                                  여부·연결 장치 오류를 점검해 여기에 보여줘요.
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <KioskCommandButton
                                kioskId={k.id}
                                command="relogin"
                                label="다시 로그인"
                                confirmMessage={`"${k.name}"의 화면 세션을 초기화하고 처음부터 다시 열까요? 이용 중인 손님이 있다면 진행 중인 화면이 닫혀요.`}
                                className={BTN}
                              />
                              <KioskCommandButton kioskId={k.id} command="restart_program" label="프로그램 재시작" className={BTN} />
                              <KioskCommandButton
                                kioskId={k.id}
                                command="restart_device"
                                label="기기 재시작"
                                confirmMessage={`"${k.name}" 기기를 재시작할까요? 1~2분 정도 이용할 수 없어요.`}
                                className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
                              />
                              <KioskCommandButton
                                kioskId={k.id}
                                command="shutdown_device"
                                label="기기 종료"
                                confirmMessage={`"${k.name}" 기기를 종료할까요? 매장에 직접 가야 다시 켤 수 있어요.`}
                                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                              />
                            </div>
                            <form action={updateDailyRebootTime} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={k.id} />
                              <label className="text-xs text-zinc-500">매일 자동 재부팅 시각</label>
                              <input
                                type="time"
                                name="daily_reboot_time"
                                defaultValue={k.daily_reboot_time ?? ""}
                                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
                              />
                              <button type="submit" className={BTN}>
                                저장
                              </button>
                              <span className="text-xs text-zinc-400">비워두면 자동 재부팅 안 함</span>
                            </form>
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                  {isAdmin && (
                    <tr className="border-t border-zinc-100 bg-zinc-50/50">
                      <td colSpan={5} className="px-4 py-3">
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
                            <button type="submit" className={BTN}>
                              저장
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {kiosks.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-6 text-center text-zinc-400">
                  등록된 키오스크가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-400">
        “화면 미리보기”가 실제 구매자 화면(/kiosk/[id])이에요 — 이 주소를 키오스크 하드웨어의 브라우저가
        전체화면으로 띄우면 그대로 매장에 쓸 수 있습니다. 화면과 kiosk-agent가 보내는 신호가{" "}
        {OFFLINE_THRESHOLD_MINUTES}분 넘게 끊기면 “키오스크 응답 없음” 알림이 화면 위쪽 빨간 배너로 뜨고, 일일 요약에도
        정리됩니다. “새로고침”·“다시 로그인”은 화면 자체가 처리하지만, 상태 점검과 프로그램/기기 재시작·종료·매일 자동
        재부팅은 키오스크 PC(Windows)에 <span className="font-mono text-xs">kiosk-agent</span>(저장소의 kiosk-agent
        폴더, PowerShell 스크립트)를 설치해둬야 실제로 동작합니다.
      </p>
    </div>
  );
}
