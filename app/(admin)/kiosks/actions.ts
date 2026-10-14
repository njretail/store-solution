"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentStore } from "@/lib/session";

export async function createKiosk(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("kiosks").insert({ store_id: store.id, name });
  revalidatePath("/kiosks");
}

export async function updateKioskStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "online");
  if (!id) return;

  await supabase
    .from("kiosks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/kiosks");
}

export async function updateKioskDisplay(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const notice_message = String(formData.get("notice_message") ?? "").trim() || null;
  const banner_message = String(formData.get("banner_message") ?? "").trim() || null;

  await supabase
    .from("kiosks")
    .update({ notice_message, banner_message })
    .eq("id", id);

  revalidatePath("/kiosks");
}

// relogin(다시 로그인): 화면은 저장된 세션·설정을 비우고 다시 열고, kiosk-agent는 브라우저 프로필을
// 초기화한 뒤 재실행한다. health_check(상태 점검): kiosk-agent가 기기 상태를 점검해 /health로 보고한다.
const KIOSK_COMMANDS = [
  "refresh",
  "relogin",
  "health_check",
  "restart_program",
  "restart_device",
  "shutdown_device",
] as const;

// "새로고침"은 키오스크 화면(/kiosk/[id]) 자체가 20초마다 폴링해서 처리하지만,
// 나머지 셋(프로그램/기기 재시작, 기기 종료)은 브라우저가 할 수 없는 OS 영역이라
// 그 PC에 설치된 kiosk-agent(PowerShell, kiosk-agent/ 폴더 참고)가 같은 값을
// 폴링해서 실제로 실행한다 — 에이전트가 없으면 이 버튼들은 아무 효과가 없다.
export async function sendKioskCommand(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const command = String(formData.get("command") ?? "");
  if (!id || !KIOSK_COMMANDS.includes(command as (typeof KIOSK_COMMANDS)[number])) return;

  await supabase
    .from("kiosks")
    .update({ remote_command: command, remote_command_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/kiosks");
}

export async function updateDailyRebootTime(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const raw = String(formData.get("daily_reboot_time") ?? "").trim();
  await supabase
    .from("kiosks")
    .update({ daily_reboot_time: raw || null })
    .eq("id", id);

  revalidatePath("/kiosks");
}

export async function deleteKiosk(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("kiosks").delete().eq("id", id);
  revalidatePath("/kiosks");
}
