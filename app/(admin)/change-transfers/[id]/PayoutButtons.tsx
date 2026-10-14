"use client";

import { setChangeTransferStatus } from "../actions";

// 지불 완료 / 지급 취소 — 둘 다 되돌릴 수 없고(계좌번호가 즉시 파기됨) 확인 창을 한 번 더 띄운다.
export default function PayoutButtons({ id, amount, account }: { id: string; amount: number; account: string }) {
  return (
    <div className="flex flex-col gap-3">
      <form
        action={setChangeTransferStatus}
        onSubmit={(e) => {
          if (!confirm(`${account} 계좌로 ${amount.toLocaleString()}원을 송금하셨나요?\n완료 처리하면 계좌번호가 파기되어 다시 볼 수 없어요.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="paid" />
        <button
          type="submit"
          className="w-full rounded-xl bg-[#C8075F] px-4 py-4 text-base font-semibold text-white hover:bg-[#a80650]"
        >
          지불 완료
        </button>
      </form>
      <form
        action={setChangeTransferStatus}
        onSubmit={(e) => {
          if (!confirm("이 요청을 지급 취소할까요? (중복 신청·허위 신청 등) 계좌번호가 파기됩니다.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="cancelled" />
        <button type="submit" className="w-full py-2 text-sm text-zinc-500 underline hover:text-zinc-700">
          지급 취소
        </button>
      </form>
    </div>
  );
}
