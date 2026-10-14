"use client";

import { useState } from "react";
import { KIOSK_STRINGS, type KioskLang } from "@/lib/kiosk-i18n";
import { BANK_NAMES, type ChangeTransferReason } from "@/lib/types";

// 받는 방법은 계좌이체 하나뿐이다. 개인정보는 은행명·계좌번호만 받고(이름·연락처 없음),
// 개인정보 수집·이용 동의(목적·항목·보유기간·거부권 고지)에 체크해야만 신청할 수 있다.
export default function ChangeRequestForm({ kioskId, lang }: { kioskId: string; lang: KioskLang }) {
  const t = KIOSK_STRINGS[lang];
  const [reason, setReason] = useState<ChangeTransferReason | null>(null);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 16);
  const mismatch = accountConfirm.length > 0 && accountConfirm !== accountNumber;
  const canSubmit =
    !!reason &&
    Number(amount) > 0 &&
    !!bankName &&
    accountNumber.length >= 10 &&
    accountNumber === accountConfirm &&
    consent &&
    !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/kiosk/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kiosk_id: kioskId,
          reason,
          amount: Number(amount),
          bank_name: bankName,
          account_number: accountNumber,
          privacy_consent: consent,
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
        <p className="text-lg font-semibold text-green-600">{t.doneTitle}</p>
        <p className="text-sm text-zinc-500">{t.doneBody}</p>
      </div>
    );
  }

  // 1단계: 사유 선택 — 잔돈 부족 / 기기 오류
  if (!reason) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-base font-semibold">{t.reasonTitle}</p>
        {(
          [
            ["change_shortage", t.reasonShortage, t.reasonShortageDesc],
            ["dispense_error", t.reasonError, t.reasonErrorDesc],
          ] as const
        ).map(([value, title, desc]) => (
          <button
            key={value}
            type="button"
            onClick={() => setReason(value)}
            className="rounded-xl border-2 border-zinc-200 px-4 py-4 text-left hover:border-[#C8075F] active:bg-[#C8075F]/5"
          >
            <p className="text-base font-semibold text-zinc-900">{title}</p>
            <p className="mt-1 text-sm text-zinc-500">{desc}</p>
          </button>
        ))}
        <p className="mt-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">{t.transferOnlyNote}</p>
      </div>
    );
  }

  // 2단계: 금액·은행·계좌번호 입력 + 개인정보 동의
  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg bg-[#C8075F]/5 px-3 py-2 text-sm">
        <span className="font-medium text-[#C8075F]">
          {reason === "change_shortage" ? t.reasonShortage : t.reasonError}
        </span>
        <button type="button" onClick={() => setReason(null)} className="text-xs text-zinc-500 underline">
          {t.back}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">{t.amountLabel}</label>
        <input
          inputMode="numeric"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder={t.amountPlaceholder}
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">{t.bankNameLabel}</label>
        <select
          required
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-base"
        >
          <option value="">{t.bankSelectPlaceholder}</option>
          {BANK_NAMES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">{t.accountNumberLabel}</label>
        <input
          inputMode="numeric"
          autoComplete="off"
          required
          value={accountNumber}
          onChange={(e) => setAccountNumber(digitsOnly(e.target.value))}
          placeholder={t.accountNumberPlaceholder}
          className="rounded border border-zinc-300 px-3 py-2 text-base tracking-wider"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-600">{t.accountConfirmLabel}</label>
        <input
          inputMode="numeric"
          autoComplete="off"
          required
          value={accountConfirm}
          onChange={(e) => setAccountConfirm(digitsOnly(e.target.value))}
          className={`rounded border px-3 py-2 text-base tracking-wider ${mismatch ? "border-red-400" : "border-zinc-300"}`}
        />
        {mismatch && <p className="text-xs text-red-600">{t.accountMismatch}</p>}
      </div>
      <p className="text-xs text-zinc-500">{t.noNameNote}</p>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <p className="mb-2 text-sm font-semibold text-zinc-800">{t.consentTitle}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <dt className="font-medium text-zinc-700">{t.consentPurposeLabel}</dt>
          <dd>{t.consentPurpose}</dd>
          <dt className="font-medium text-zinc-700">{t.consentItemsLabel}</dt>
          <dd>{t.consentItems}</dd>
          <dt className="font-medium text-zinc-700">{t.consentRetentionLabel}</dt>
          <dd>{t.consentRetention}</dd>
          <dt className="font-medium text-zinc-700">{t.consentRefusalLabel}</dt>
          <dd>{t.consentRefusal}</dd>
        </dl>
        <label className="mt-3 flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#C8075F]"
          />
          <span>{t.consentAgree}</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 rounded bg-[#C8075F] px-4 py-3 text-base font-medium text-white hover:bg-[#a80650] disabled:opacity-40"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
