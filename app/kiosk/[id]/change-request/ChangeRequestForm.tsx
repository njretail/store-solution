"use client";

import { useState } from "react";

export default function ChangeRequestForm({ kioskId }: { kioskId: string }) {
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/kiosk/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kiosk_id: kioskId,
          amount: Number(amount),
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          customer_phone: phone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류로 등록하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold text-green-600">등록되었습니다</p>
        <p className="text-sm text-zinc-500">입력하신 계좌로 확인 후 입금해 드립니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">받지 못한 금액</label>
        <input
          type="number"
          min={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="예: 1500"
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">은행명</label>
        <input
          required
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="예: 국민은행"
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">계좌번호</label>
        <input
          required
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">예금주</label>
        <input
          required
          value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">연락처 (선택)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded bg-[#C8075F] px-4 py-3 text-base font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "등록 중..." : "등록하기"}
      </button>
    </form>
  );
}
