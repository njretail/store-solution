import type { ReactNode } from "react";
import { requireProfile, getAccessibleStores, getCurrentStore } from "@/lib/session";
import AdminShell from "@/app/components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, profile } = await requireProfile();
  const stores = await getAccessibleStores(supabase);
  const currentStore = await getCurrentStore(supabase, profile);

  return (
    <AdminShell
      role={profile.role}
      storeName={currentStore?.name ?? null}
      stores={stores}
      currentStoreId={currentStore?.id ?? null}
    >
      {profile.role === "admin" && stores.length === 0 ? (
        <p className="text-sm text-zinc-500">
          등록된 매장이 없습니다. 왼쪽 메뉴에서 매장을 먼저 추가하세요.
        </p>
      ) : !currentStore ? (
        <p className="text-sm text-zinc-500">
          소속된 매장이 없습니다. 관리자에게 문의하세요.
        </p>
      ) : (
        children
      )}
    </AdminShell>
  );
}
