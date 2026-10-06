import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Store } from "@/lib/types";
import ChangeRequestForm from "./ChangeRequestForm";

// 무인매장이라 거스름돈이 모자란 자리에 직원이 없다 — 고객이 키오스크에서 직접
// 부족한 금액과 계좌 정보를 입력해서 보내는 공개 화면. 서비스 롤로만 조회한다.
export default async function ChangeRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: kiosk } = await admin.from("kiosks").select("id, store_id").eq("id", id).maybeSingle();
  if (!kiosk) return notFound();

  const { data: store } = await admin.from("stores").select("*").eq("id", kiosk.store_id).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900">
        <h1 className="text-xl font-bold">거스름돈 계좌로 받기</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {(store as Store | null)?.name ?? "매장"} · 받지 못한 거스름돈을 입력하신 계좌로
          보내드립니다.
        </p>
        <ChangeRequestForm kioskId={kiosk.id} />
      </div>
    </div>
  );
}
