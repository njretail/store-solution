import type { ReactNode } from "react";
import { requireProfile, getAccessibleStores, getCurrentStore } from "@/lib/session";
import NavBar from "@/app/components/NavBar";
import StoreSwitcher from "@/app/components/StoreSwitcher";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, profile } = await requireProfile();
  const stores = await getAccessibleStores(supabase);
  const currentStore = await getCurrentStore(supabase, profile);

  return (
    <div className="min-h-screen bg-zinc-50">
      <NavBar role={profile.role} storeName={currentStore?.name ?? null} />

      {profile.role === "admin" && (
        <div className="border-b border-zinc-200 bg-white px-4 py-2">
          <StoreSwitcher stores={stores} currentStoreId={currentStore?.id ?? null} />
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-6">
        {profile.role === "admin" && stores.length === 0 ? (
          <p className="text-sm text-zinc-500">
            등록된 매장이 없습니다. 위에서 매장을 먼저 추가하세요.
          </p>
        ) : !currentStore ? (
          <p className="text-sm text-zinc-500">
            소속된 매장이 없습니다. 관리자에게 문의하세요.
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
