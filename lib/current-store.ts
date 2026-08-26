import { cookies } from "next/headers";

const COOKIE_NAME = "current_store_id";

export async function getCurrentStoreIdCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function setCurrentStoreIdCookie(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, storeId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
