import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStoreIdCookie } from "@/lib/current-store";
import type { Profile, Store } from "@/lib/types";

export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { supabase, profile: profile as Profile };
}

export async function requireAdmin() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") redirect("/sell");
  return { supabase, profile };
}

export async function getAccessibleStores(
  supabase: SupabaseClient
): Promise<Store[]> {
  // RLS가 admin은 전체, staff는 본인 store_id만 반환하도록 필터링한다.
  const { data } = await supabase.from("stores").select("*").order("name");
  return (data ?? []) as Store[];
}

export async function getCurrentStore(
  supabase: SupabaseClient,
  profile: Profile
): Promise<Store | null> {
  const stores = await getAccessibleStores(supabase);

  if (profile.role !== "admin") {
    return stores.find((s) => s.id === profile.store_id) ?? null;
  }

  const cookieStoreId = await getCurrentStoreIdCookie();
  return stores.find((s) => s.id === cookieStoreId) ?? stores[0] ?? null;
}
