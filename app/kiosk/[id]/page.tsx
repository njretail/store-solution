import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Kiosk, KioskAd, KioskAnnouncement, Product, Store } from "@/lib/types";
import KioskScreen from "./KioskScreen";

// 구매자가 실제로 보는 키오스크 화면 — 로그인이 없는 공개 페이지라 서비스 롤
// (admin 클라이언트, RLS 우회)로만 읽는다. 키오스크 하드웨어는 이 주소를 브라우저로
// 전체화면 띄우기만 하면 된다(/kiosks 관리 화면의 "화면 미리보기" 링크와 같은 주소).
export default async function KioskDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: kiosk } = await admin.from("kiosks").select("*").eq("id", id).maybeSingle();
  if (!kiosk) return notFound();

  const [{ data: store }, { data: adData }, { data: announcementData }, { data: boardData }] =
    await Promise.all([
      admin.from("stores").select("*").eq("id", kiosk.store_id).maybeSingle(),
      admin
        .from("kiosk_ads")
        .select("*")
        .eq("store_id", kiosk.store_id)
        .eq("active", true)
        .or(`kiosk_id.is.null,kiosk_id.eq.${id}`)
        .order("sort_order"),
      admin
        .from("kiosk_announcements")
        .select("*")
        .eq("store_id", kiosk.store_id)
        .eq("active", true)
        .or(`kiosk_id.is.null,kiosk_id.eq.${id}`)
        .order("sort_order"),
      admin
        .from("products")
        .select("id, barcode, name, sell_price")
        .eq("store_id", kiosk.store_id)
        .eq("show_on_kiosk_board", true)
        .order("name"),
    ]);

  return (
    <KioskScreen
      kiosk={kiosk as Kiosk}
      store={store as Store | null}
      ads={(adData ?? []) as KioskAd[]}
      announcements={(announcementData ?? []) as KioskAnnouncement[]}
      boardProducts={(boardData ?? []) as Pick<Product, "id" | "barcode" | "name" | "sell_price">[]}
    />
  );
}
