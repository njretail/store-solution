"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveUrgentAlert } from "@/app/(admin)/alerts/actions";
import { URGENT_ALERT_TYPE_LABELS, type UrgentAlert } from "@/lib/types";

const POLL_INTERVAL_MS = 15000;

// 로그인된 관리자 화면 전체(AdminShell)에 떠서, 어느 메뉴에 있든 긴급 알림을
// 놓치지 않게 한다. 도난/보안·냉장고 전원 등은 실제 센서 연동 전까지는 "테스트
// 알림 보내기"로만 들어오지만, /api/alerts/urgent로 실제 장비가 연동되면 그대로
// 여기에 뜬다. 15초마다 폴링 — Supabase 실시간 구독 대신 폴링을 쓴 건 별도 설정
// (replication publication)이 없어도 바로 동작하게 하기 위함.
export default function UrgentAlertBanner({ storeId }: { storeId: string | null }) {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const notifiedOnce = useRef(false);

  useEffect(() => {
    if (!storeId) return;
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data } = await supabase
        .from("urgent_alerts")
        .select("*")
        .eq("store_id", storeId)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      const rows = (data ?? []) as UrgentAlert[];
      const newOnes = rows.filter((a) => !seenIds.current.has(a.id));
      for (const a of rows) seenIds.current.add(a.id);

      if (newOnes.length > 0 && notifiedOnce.current) {
        // 첫 폴링(페이지 막 열었을 때)은 기존에 밀려있던 알림까지 "새 알림"으로
        // 취급해 매번 소리/알림이 뜨는 걸 막기 위해, 두 번째 폴링부터만 알린다.
        if ("Notification" in window && Notification.permission === "granted") {
          for (const a of newOnes) {
            new Notification("긴급 알림", { body: a.message });
          }
        }
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 880;
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => {
            osc.stop();
            ctx.close();
          }, 300);
        } catch {
          // 자동재생 제한 등으로 실패해도 화면 배너는 그대로 뜨니 무시한다.
        }
      }
      notifiedOnce.current = true;
      setAlerts(rows);
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [storeId]);

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 bg-red-600 px-4 py-2">
      {alerts.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-white">
          <span>
            🚨 <b>[{URGENT_ALERT_TYPE_LABELS[a.type]}]</b> {a.message}
            {a.source && <span className="text-red-200"> ({a.source})</span>}
            <span className="ml-2 text-red-200">{new Date(a.created_at).toLocaleTimeString("ko-KR")}</span>
          </span>
          <form action={resolveUrgentAlert}>
            <input type="hidden" name="id" value={a.id} />
            <button
              type="submit"
              className="rounded bg-white/20 px-2 py-1 text-xs font-medium hover:bg-white/30"
            >
              확인(해결)
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
