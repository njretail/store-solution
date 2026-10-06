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

// 키오스크 화면(/kiosk/[id])이 20초 간격으로 remote_command_at을 폴링하다가
// 바뀐 걸 감지하면 새로고침한다 — 명령 내용 자체(remote_command)는 지금은 "refresh"
// 하나뿐이라 큰 의미는 없고, 시각만 "새 명령이 도착했다"는 신호로 쓴다.
export async function sendKioskRefresh(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("kiosks")
    .update({ remote_command: "refresh", remote_command_at: new Date().toISOString() })
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
