import { requireProfile, getCurrentStore } from "@/lib/session";
import SellPos from "./SellPos";

export default async function SellPage() {
  const { supabase, profile } = await requireProfile();
  const store = await getCurrentStore(supabase, profile);
  if (!store) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">실시간 장바구니</h1>
        <p className="text-sm text-zinc-500">{store.name}</p>
      </div>
      <SellPos storeId={store.id} />
    </div>
  );
}
