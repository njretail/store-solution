"use client";

import { useState, useTransition } from "react";
import { lookupPoints, verifyPointPin } from "./actions";
import { earnPreview, maxUsablePoints, type PointSummary } from "@/lib/points";
import { CUSTOMER_CENTER, CUSTOMER_CENTER_LINE } from "@/lib/support";

export type PointUse = { points: number; token: string | null };

/**
 * 판매 화면(키오스크 세로 화면 포함)의 포인트 영역.
 * 번호로 조회 → 쓸 포인트 입력 → (규칙상 필요하면) 비밀번호 4자리 확인 → 결제 폼에 points/token 전달.
 * 최종 검사는 결제 시 DB(record_sale)가 다시 한다.
 */
export default function PointsPanel({
  phone,
  payAmount,
  value,
  onChange,
}: {
  phone: string;
  payAmount: number;
  value: PointUse;
  onChange: (v: PointUse) => void;
}) {
  const [summary, setSummary] = useState<PointSummary | null>(null);
  const [lookedUpPhone, setLookedUpPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const digits = phone.replace(/[^0-9]/g, "");
  const validPhone = /^01\d{8,9}$/.test(digits);
  // 번호가 바뀌면 이전 조회 결과는 버린다
  const current = summary && lookedUpPhone === digits ? summary : null;

  function reset() {
    setPin("");
    setPinConfirm("");
    setInfo(null);
    setError(null);
    onChange({ points: 0, token: null });
  }

  function lookup() {
    reset();
    startTransition(async () => {
      const r = await lookupPoints(digits);
      if (r.error || !r.summary) return setError(r.error);
      setSummary(r.summary);
      setLookedUpPhone(digits);
    });
  }

  function verify() {
    setError(null);
    if (!/^\d{4}$/.test(pin)) return setError("비밀번호는 숫자 4자리예요.");
    if (current && !current.has_pin && pin !== pinConfirm) return setError("두 번 입력한 비밀번호가 달라요.");
    startTransition(async () => {
      const r = await verifyPointPin(digits, pin);
      setPin("");
      setPinConfirm("");
      if (r.error || !r.token) return setError(r.error);
      onChange({ ...value, token: r.token });
      setInfo(r.createdPin ? "비밀번호를 등록했어요. 다음부터 이 번호로 확인해요." : "확인됐어요. 5분 안에 결제해 주세요.");
      if (current) setSummary({ ...current, has_pin: true });
    });
  }

  if (!validPhone) return null;

  if (!current) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={lookup} disabled={pending} className="rounded border border-[#C8075F] px-3 py-1.5 text-sm font-medium text-[#C8075F] disabled:opacity-50">
          {pending ? "조회 중..." : "포인트 조회"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  if (!current.enabled) return null;

  const max = maxUsablePoints(current, payAmount);
  const p = current.policy;
  const needPin = p.require_pin && value.points > 0 && !value.token;
  const earn = earnPreview(p, Math.max(payAmount - value.points, 0));

  return (
    <div className="flex flex-col gap-2 rounded-md border border-pink-200 bg-pink-50/50 p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-zinc-600">
          {current.customer_exists ? "보유 포인트" : "처음 오신 손님"}
        </span>
        <span className="text-lg font-semibold text-[#C8075F]">
          {current.balance.toLocaleString()}점
        </span>
      </div>
      {current.pending > 0 && <p className="text-xs text-zinc-500">사용 대기 {current.pending.toLocaleString()}점 (적립 {p.available_after_days}일 뒤 사용 가능)</p>}
      {current.expiring_30d > 0 && <p className="text-xs text-amber-600">30일 안에 {current.expiring_30d.toLocaleString()}점이 소멸돼요</p>}

      {current.locked ? (
        <p className="text-xs text-red-600">비밀번호를 5번 틀려 10분간 포인트를 쓸 수 없어요. 적립은 돼요. 비밀번호를 잊으셨으면 {CUSTOMER_CENTER_LINE}로 연락 주세요.</p>
      ) : current.can_use ? (
        <>
          <div className="flex items-center gap-2">
            <input
              value={value.points || ""}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value.replace(/[^0-9]/g, "")) || 0));
                onChange({ points: n, token: value.token });
              }}
              inputMode="numeric"
              placeholder={`사용할 포인트 (최대 ${max.toLocaleString()})`}
              className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-right"
            />
            <button type="button" onClick={() => onChange({ points: max, token: value.token })} disabled={max === 0} className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs disabled:opacity-40">
              최대
            </button>
            {value.points > 0 && (
              <button type="button" onClick={() => onChange({ points: 0, token: value.token })} className="text-xs text-zinc-500 underline">
                안 쓰기
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {p.use_unit.toLocaleString()}점 단위{p.max_use_rate < 100 ? ` · 결제금액의 ${p.max_use_rate}%까지` : ""}
          </p>
          {value.points > 0 && value.points % p.use_unit !== 0 && <p className="text-xs text-red-600">{p.use_unit.toLocaleString()}점 단위로 입력해 주세요.</p>}
          {value.points > max && <p className="text-xs text-red-600">이번 결제엔 최대 {max.toLocaleString()}점까지 쓸 수 있어요.</p>}

          {needPin && (
            <div className="flex flex-col gap-1.5 rounded bg-white p-2">
              <p className="text-xs font-medium text-zinc-700">
                {current.has_pin ? "포인트 비밀번호 4자리" : "처음 쓰시네요 — 포인트 비밀번호 4자리를 정해 주세요"}
              </p>
              <div className="flex gap-2">
                <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" placeholder="••••" className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-center tracking-[0.4em]" />
                {!current.has_pin && (
                  <input value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" placeholder="한 번 더" className="w-24 rounded border border-zinc-300 px-2 py-1.5 text-center" />
                )}
                <button type="button" onClick={verify} disabled={pending} className="rounded bg-[#C8075F] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  {pending ? "확인 중" : "확인"}
                </button>
              </div>
              {current.has_pin && (
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  비밀번호를 잊으셨나요? <a href={`tel:${CUSTOMER_CENTER.tel}`} className="font-medium text-[#C8075F]">{CUSTOMER_CENTER_LINE}</a>로
                  연락 주시면 초기화해 드려요. 포인트는 그대로 남아 있어요.
                </p>
              )}
            </div>
          )}
          {value.points > 0 && value.token && <p className="text-xs text-green-700">✓ {info ?? "비밀번호 확인됨"}</p>}
        </>
      ) : (
        current.customer_exists && (
          <p className="text-xs text-zinc-500">
            {p.min_balance_to_use.toLocaleString()}점부터 쓸 수 있어요 ({Math.max(p.min_balance_to_use - current.balance, 0).toLocaleString()}점 더 모으면 사용 가능)
          </p>
        )
      )}

      {earn > 0 ? (
        <p className="text-xs text-zinc-600">이번 결제 적립 예정 <b className="text-[#C8075F]">약 {earn.toLocaleString()}점</b> (할인 반영 후 최종 금액 기준)</p>
      ) : p.min_purchase_for_earn > 0 && payAmount > 0 && payAmount < p.min_purchase_for_earn ? (
        <p className="text-xs text-zinc-500">{(p.min_purchase_for_earn - payAmount).toLocaleString()}원 더 사면 적립돼요</p>
      ) : null}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
