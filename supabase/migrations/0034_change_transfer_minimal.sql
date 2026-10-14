-- 거스름돈 계좌이체 요청을 "개인정보 최소 수집" 방식으로 바꾼다.
-- 키오스크에서 고객이 직접 등록할 때는 은행명·계좌번호만 받는다(예금주 이름·연락처는
-- 받지 않음 — 송금 시 은행의 예금주 조회로 확인 가능). 그래서 예금주를 필수에서 뺀다.
alter table public.change_transfer_requests alter column account_holder drop not null;

-- 계좌로 받게 된 사유 — 잔돈(현금)이 모자라서 / 잔돈은 있었지만 기기 배출 오류로 못 받아서.
-- 직원이 관리자 화면에서 등록하는 건은 사유가 없을 수 있어 null 허용.
alter table public.change_transfer_requests
  add column if not exists reason text
    check (reason in ('change_shortage', 'dispense_error'));

-- 어느 키오스크에서 등록됐는지(CCTV·시재 대조 시 위치 확인용).
alter table public.change_transfer_requests
  add column if not exists kiosk_id uuid references public.kiosks (id) on delete set null;

-- 개인정보 수집·이용 동의 시각 — 키오스크 화면에서 동의 체크 후에만 등록되므로,
-- 동의 기록을 남겨둔다(직원 등록 건은 null).
alter table public.change_transfer_requests
  add column if not exists privacy_consent_at timestamptz;

-- 보유기간 = "송금 완료 또는 취소 시까지". 지급완료/지급취소로 바뀌는 순간 계좌번호는
-- 끝 4자리만 남기고 지운다(정산 확인용 최소 흔적). 예금주·연락처·고객명도 함께 지운다.
-- 화면 코드에서 빠뜨려도 DB가 보장하도록 트리거로 둔다.
create or replace function public.mask_change_transfer_on_close()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status in ('paid', 'cancelled') then
    new.account_number := '****' || right(regexp_replace(new.account_number, '[^0-9]', '', 'g'), 4);
    new.account_holder := null;
    new.customer_name := null;
    new.customer_phone := null;
  end if;
  return new;
end;
$$;

drop trigger if exists change_transfer_mask_on_close on public.change_transfer_requests;
create trigger change_transfer_mask_on_close
  before update on public.change_transfer_requests
  for each row execute function public.mask_change_transfer_on_close();

-- 이미 지급완료/지급취소된 기존 건도 같은 기준으로 정리한다.
update public.change_transfer_requests
set account_number = '****' || right(regexp_replace(account_number, '[^0-9]', '', 'g'), 4),
    account_holder = null,
    customer_name = null,
    customer_phone = null
where status in ('paid', 'cancelled') and account_number not like '****%';
