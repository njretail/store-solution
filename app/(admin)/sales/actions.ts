"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export async function cancelSale(saleId: string): Promise<{ error: string | null }> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: saleId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { error: null };
}
