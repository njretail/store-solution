"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffState = { error: string | null; success: string | null };

export async function createStaff(
  _prevState: StaffState,
  formData: FormData
): Promise<StaffState> {
  const { supabase } = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "staff");
  const store_id = String(formData.get("store_id") ?? "") || null;

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력하세요.", success: null };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다.", success: null };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return {
      error: createError?.message ?? "계정 생성에 실패했습니다.",
      success: null,
    };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    role,
    store_id,
    name,
    email,
    phone,
  });

  if (profileError) {
    return { error: profileError.message, success: null };
  }

  revalidatePath("/staff");
  return { error: null, success: `${email} 계정이 생성되었습니다.` };
}

export async function updateStaff(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const role = String(formData.get("role") ?? "staff");
  const store_id = String(formData.get("store_id") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  await supabase.from("profiles").update({ role, store_id, phone }).eq("id", id);
  revalidatePath("/staff");
}

export async function deleteStaff(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/staff");
}
