-- 포인트 적립 — 매장에서 산 손님에게 결제금액의 N%를 적립하고, 다음 결제 때 쓰게 한다.
-- 0041_kiosk_coupons.sql 실행 이후, Supabase SQL Editor에서 실행하세요. 다시 실행해도 안전합니다.
--
-- 구조
--   point_policies : 매장별 규칙(적립률, 적립 최소 결제금액, 사용 가능 시점, 최소 사용 포인트, 사용 단위,
--                    1회 최대 사용 비율, 유효기간, 비밀번호 인증 여부). 처음엔 꺼져 있다(enabled=false).
--   point_ledger   : 적립·사용·취소·조정 내역. 적립 건(+)은 remaining(남은 양)을 들고 있어서
--                    사용할 때 유효기간이 빠른 것부터 깎는다. 잔액 = 지금 쓸 수 있는 적립 건 remaining 합.
--   customers      : 포인트 비밀번호(4자리, 해시 저장)와 틀린 횟수·잠금, 결제용 1회 인증 토큰.
--
-- 인증 흐름: 적립은 전화번호만. 사용은 전화번호 + 포인트 비밀번호 4자리.
--   verify_point_pin()이 맞으면 5분짜리 1회용 토큰을 주고, record_sale()은 그 토큰이 있어야 포인트를 깎는다.
--   (비밀번호 확인을 결제와 분리한 이유: 결제 함수 안에서 틀린 횟수를 올리고 오류를 내면 함께 취소돼 횟수가 안 쌓인다)
--   5번 틀리면 10분 잠금. 처음 쓰는 손님은 이때 비밀번호를 새로 정한다.
--
-- 함께 고침: record_sale이 번호 없는 결제·신규 고객 결제에서 "v_customer_coupon is not assigned yet"으로 실패하던 문제(0024부터).
--
-- 취소: 판매가 cancelled로 바뀌면(판매 취소·배송 취소 모두) 트리거가 적립분을 회수하고 사용분을 돌려준다.

create extension if not exists pgcrypto with schema extensions;

-- ── 매장별 규칙 ─────────────────────────────────────────────
create table if not exists public.point_policies (
  store_id uuid primary key references public.stores (id),
  enabled boolean not null default false,
  earn_rate numeric(5,2) not null default 1.0 check (earn_rate >= 0 and earn_rate <= 50),   -- 결제금액의 %
  min_purchase_for_earn integer not null default 0 check (min_purchase_for_earn >= 0),       -- 이 금액 이상 결제해야 적립
  available_after_days integer not null default 0 check (available_after_days between 0 and 365), -- 0 = 바로 사용
  min_balance_to_use integer not null default 1000 check (min_balance_to_use >= 0),          -- 이만큼 모여야 사용 가능
  use_unit integer not null default 100 check (use_unit >= 1),                                -- 사용 단위(점)
  max_use_rate integer not null default 100 check (max_use_rate between 1 and 100),          -- 결제금액의 최대 %까지 사용
  expire_months integer not null default 12 check (expire_months between 0 and 120),         -- 0 = 소멸 없음
  require_pin boolean not null default true,                                                  -- 사용 시 비밀번호 확인
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.point_policies enable row level security;
drop policy if exists "point_policies select" on public.point_policies;
create policy "point_policies select" on public.point_policies for select
  using (exists (select 1 from public.current_profile() cp
                 where cp.role = 'admin' or cp.store_id = point_policies.store_id));
drop policy if exists "point_policies admin write" on public.point_policies;
create policy "point_policies admin write" on public.point_policies for all
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'))
  with check (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));

-- ── 내역 ───────────────────────────────────────────────────
create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  customer_id uuid not null references public.customers (id),
  sale_id uuid references public.sales (id),
  kind text not null check (kind in ('earn', 'use', 'cancel_earn', 'cancel_use', 'adjust')),
  amount integer not null,                 -- +적립 / -사용
  remaining integer not null default 0,    -- (+)건에서 아직 안 쓴 양
  available_at timestamptz not null default now(),
  expires_at timestamptz,
  memo text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists point_ledger_customer_idx on public.point_ledger (customer_id, created_at desc);
create index if not exists point_ledger_lots_idx on public.point_ledger (customer_id, expires_at) where remaining > 0;
create index if not exists point_ledger_sale_idx on public.point_ledger (sale_id);
create index if not exists point_ledger_store_idx on public.point_ledger (store_id, created_at desc);

alter table public.point_ledger enable row level security;
drop policy if exists "point_ledger select" on public.point_ledger;
create policy "point_ledger select" on public.point_ledger for select
  using (exists (select 1 from public.current_profile() cp
                 where cp.role = 'admin' or cp.store_id = point_ledger.store_id));
-- 쓰기 정책은 없다: 아래 함수(security definer)로만 쓴다.

alter table public.sales add column if not exists points_used integer not null default 0;
alter table public.sales add column if not exists points_earned integer not null default 0;

alter table public.customers add column if not exists point_pin_hash text;
alter table public.customers add column if not exists point_pin_failed integer not null default 0;
alter table public.customers add column if not exists point_pin_locked_until timestamptz;
alter table public.customers add column if not exists point_auth_token uuid;
alter table public.customers add column if not exists point_auth_expires timestamptz;
-- 비밀번호 분실 시 관리자 초기화 기록 (누가·언제)
alter table public.customers add column if not exists point_pin_reset_at timestamptz;
alter table public.customers add column if not exists point_pin_reset_by uuid references public.profiles (id);

-- ── 내부 도우미 (직접 호출 불가) ─────────────────────────────

-- 호출자가 이 매장을 다룰 수 있는지. 키오스크 서버(service_role)는 auth.uid()가 없어서 통과.
create or replace function public._point_assert_store(p_store_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller record;
begin
  if auth.uid() is null then return; end if;
  select * into v_caller from public.current_profile();
  if v_caller.role is null or (v_caller.role <> 'admin' and v_caller.store_id is distinct from p_store_id) then
    raise exception '권한이 없습니다';
  end if;
end; $$;

create or replace function public._point_available(p_customer_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(remaining), 0)::integer from public.point_ledger
  where customer_id = p_customer_id and remaining > 0
    and available_at <= now() and (expires_at is null or expires_at > now());
$$;

create or replace function public._point_pending(p_customer_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(remaining), 0)::integer from public.point_ledger
  where customer_id = p_customer_id and remaining > 0
    and available_at > now() and (expires_at is null or expires_at > now());
$$;

-- 쓸 수 있는 적립 건에서 유효기간이 빠른 것부터 깎는다. 실제로 깎은 양을 돌려준다.
create or replace function public._point_consume(p_customer_id uuid, p_amount integer, p_only_lot uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_left integer := p_amount; v_lot record; v_take integer;
begin
  for v_lot in
    select id, remaining from public.point_ledger
    where customer_id = p_customer_id and remaining > 0
      and (p_only_lot is null or id = p_only_lot)
      and (p_only_lot is not null or (available_at <= now() and (expires_at is null or expires_at > now())))
    order by expires_at nulls last, created_at
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_lot.remaining);
    update public.point_ledger set remaining = remaining - v_take where id = v_lot.id;
    v_left := v_left - v_take;
  end loop;
  return p_amount - v_left;
end; $$;

-- 결제 1건에 대한 적립. 규칙이 꺼져 있거나 최소 결제금액 미만이면 0.
create or replace function public._point_earn(p_store_id uuid, p_customer_id uuid, p_sale_id uuid, p_paid integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_policy public.point_policies; v_earn integer;
begin
  select * into v_policy from public.point_policies where store_id = p_store_id;
  if v_policy.store_id is null or not v_policy.enabled or p_customer_id is null then return 0; end if;
  if p_paid <= 0 or p_paid < v_policy.min_purchase_for_earn then return 0; end if;
  v_earn := floor(p_paid * v_policy.earn_rate / 100)::integer;
  if v_earn <= 0 then return 0; end if;
  insert into public.point_ledger (store_id, customer_id, sale_id, kind, amount, remaining, available_at, expires_at, memo)
  values (p_store_id, p_customer_id, p_sale_id, 'earn', v_earn, v_earn,
          now() + make_interval(days => v_policy.available_after_days),
          case when v_policy.expire_months > 0 then now() + make_interval(months => v_policy.expire_months) end,
          format('결제 %s원의 %s%%', p_paid, v_policy.earn_rate));
  return v_earn;
end; $$;

revoke all on function public._point_assert_store(uuid) from public, anon, authenticated;
revoke all on function public._point_available(uuid) from public, anon, authenticated;
revoke all on function public._point_pending(uuid) from public, anon, authenticated;
revoke all on function public._point_consume(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public._point_earn(uuid, uuid, uuid, integer) from public, anon, authenticated;

-- ── 조회: 번호로 잔액·규칙 확인 (판매 화면·키오스크) ──────────────
create or replace function public.point_summary(p_store_id uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_policy public.point_policies; v_c public.customers; v_bal integer := 0; v_pend integer := 0; v_soon integer := 0;
begin
  perform public._point_assert_store(p_store_id);
  select * into v_policy from public.point_policies where store_id = p_store_id;
  select * into v_c from public.customers where store_id = p_store_id and phone = trim(coalesce(p_phone, ''));
  if v_c.id is not null then
    v_bal := public._point_available(v_c.id);
    v_pend := public._point_pending(v_c.id);
    select coalesce(sum(remaining), 0)::integer into v_soon from public.point_ledger
      where customer_id = v_c.id and remaining > 0 and available_at <= now()
        and expires_at is not null and expires_at > now() and expires_at <= now() + interval '30 days';
  end if;
  return jsonb_build_object(
    'enabled', coalesce(v_policy.enabled, false),
    'customer_exists', v_c.id is not null,
    'balance', v_bal,
    'pending', v_pend,
    'expiring_30d', v_soon,
    'has_pin', v_c.point_pin_hash is not null,
    'locked', v_c.point_pin_locked_until is not null and v_c.point_pin_locked_until > now(),
    'can_use', coalesce(v_policy.enabled, false) and v_bal >= coalesce(v_policy.min_balance_to_use, 0) and v_bal > 0,
    'policy', jsonb_build_object(
      'earn_rate', coalesce(v_policy.earn_rate, 0),
      'min_purchase_for_earn', coalesce(v_policy.min_purchase_for_earn, 0),
      'available_after_days', coalesce(v_policy.available_after_days, 0),
      'min_balance_to_use', coalesce(v_policy.min_balance_to_use, 0),
      'use_unit', coalesce(v_policy.use_unit, 1),
      'max_use_rate', coalesce(v_policy.max_use_rate, 100),
      'expire_months', coalesce(v_policy.expire_months, 0),
      'require_pin', coalesce(v_policy.require_pin, true)
    )
  );
end; $$;

-- ── 비밀번호 확인 → 5분짜리 1회용 결제 토큰 ─────────────────────
-- 비밀번호가 없는 손님이면 이때 새로 정한다(화면에서 두 번 입력받아 맞는지 확인한 뒤 호출).
-- 돌려주는 값: { ok, token?, created_pin?, error?, attempts_left? }  (틀려도 오류를 내지 않아 횟수가 저장된다)
create or replace function public.verify_point_pin(p_store_id uuid, p_phone text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c public.customers; v_token uuid; v_fail integer;
begin
  perform public._point_assert_store(p_store_id);
  if coalesce(p_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'error', '비밀번호는 숫자 4자리예요');
  end if;
  select * into v_c from public.customers
    where store_id = p_store_id and phone = trim(coalesce(p_phone, '')) for update;
  if v_c.id is null then
    return jsonb_build_object('ok', false, 'error', '포인트가 없는 번호예요');
  end if;
  if v_c.point_pin_locked_until is not null and v_c.point_pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', '비밀번호를 5번 틀려 10분간 잠겼어요. 잠시 후 다시 해 주세요');
  end if;

  if v_c.point_pin_hash is null then
    -- 처음: 이 비밀번호로 등록
    if p_pin in ('0000', '1111', '1234', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '4321') then
      return jsonb_build_object('ok', false, 'error', '너무 쉬운 비밀번호예요. 다른 숫자로 정해 주세요');
    end if;
    v_token := gen_random_uuid();
    update public.customers set point_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      point_pin_failed = 0, point_pin_locked_until = null,
      point_auth_token = v_token, point_auth_expires = now() + interval '5 minutes'
      where id = v_c.id;
    return jsonb_build_object('ok', true, 'token', v_token, 'created_pin', true);
  end if;

  if extensions.crypt(p_pin, v_c.point_pin_hash) = v_c.point_pin_hash then
    v_token := gen_random_uuid();
    update public.customers set point_pin_failed = 0, point_pin_locked_until = null,
      point_auth_token = v_token, point_auth_expires = now() + interval '5 minutes'
      where id = v_c.id;
    return jsonb_build_object('ok', true, 'token', v_token, 'created_pin', false);
  end if;

  v_fail := v_c.point_pin_failed + 1;
  update public.customers set
    point_pin_failed = case when v_fail >= 5 then 0 else v_fail end,
    point_pin_locked_until = case when v_fail >= 5 then now() + interval '10 minutes' else null end
    where id = v_c.id;
  if v_fail >= 5 then
    return jsonb_build_object('ok', false, 'error', '비밀번호를 5번 틀려 10분간 잠겼어요', 'attempts_left', 0);
  end if;
  return jsonb_build_object('ok', false, 'error', format('비밀번호가 맞지 않아요 (남은 기회 %s번)', 5 - v_fail), 'attempts_left', 5 - v_fail);
end; $$;

-- ── 관리자: 직접 적립/차감, 비밀번호 초기화 ─────────────────────
create or replace function public.point_adjust(p_customer_id uuid, p_amount integer, p_memo text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_caller record; v_c public.customers; v_policy public.point_policies; v_done integer;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is distinct from 'admin' then raise exception '관리자만 조정할 수 있습니다'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception '조정할 포인트를 입력하세요'; end if;
  if length(trim(coalesce(p_memo, ''))) = 0 then raise exception '조정 사유를 입력하세요'; end if;
  select * into v_c from public.customers where id = p_customer_id;
  if v_c.id is null then raise exception '고객을 찾을 수 없습니다'; end if;
  select * into v_policy from public.point_policies where store_id = v_c.store_id;

  if p_amount > 0 then
    insert into public.point_ledger (store_id, customer_id, kind, amount, remaining, expires_at, memo, created_by)
    values (v_c.store_id, v_c.id, 'adjust', p_amount, p_amount,
            case when coalesce(v_policy.expire_months, 12) > 0 then now() + make_interval(months => coalesce(v_policy.expire_months, 12)) end,
            trim(p_memo), auth.uid());
    return p_amount;
  end if;
  v_done := public._point_consume(v_c.id, -p_amount);
  if v_done = 0 then raise exception '차감할 포인트가 없습니다'; end if;
  insert into public.point_ledger (store_id, customer_id, kind, amount, memo, created_by)
  values (v_c.store_id, v_c.id, 'adjust', -v_done, trim(p_memo), auth.uid());
  return -v_done;
end; $$;

-- 비밀번호 분실: 관리자가 초기화하면 손님은 다음에 포인트를 쓸 때 새 비밀번호를 정한다. 포인트는 그대로.
create or replace function public.point_reset_pin(p_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller record;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is distinct from 'admin' then raise exception '관리자만 초기화할 수 있습니다'; end if;
  update public.customers set point_pin_hash = null, point_pin_failed = 0, point_pin_locked_until = null,
    point_auth_token = null, point_auth_expires = null,
    point_pin_reset_at = now(), point_pin_reset_by = auth.uid()
    where id = p_customer_id;
  if not found then raise exception '고객을 찾을 수 없습니다'; end if;
end; $$;

revoke all on function public.point_summary(uuid, text) from public, anon;
revoke all on function public.verify_point_pin(uuid, text, text) from public, anon;
revoke all on function public.point_adjust(uuid, integer, text) from public, anon;
revoke all on function public.point_reset_pin(uuid) from public, anon;
grant execute on function public.point_summary(uuid, text) to authenticated, service_role;
grant execute on function public.verify_point_pin(uuid, text, text) to authenticated, service_role;
grant execute on function public.point_adjust(uuid, integer, text) to authenticated;
grant execute on function public.point_reset_pin(uuid) to authenticated;

-- ── record_sale: 포인트 사용·적립 추가 ──────────────────────────
-- 새 매개변수 p_use_points(쓸 포인트), p_point_token(비밀번호 확인 토큰). 안 넘기면 포인트는 적립만 된다.
drop function if exists public.record_sale(text, jsonb, text, integer, text, uuid, boolean);
drop function if exists public.record_sale(text, jsonb, text, integer, text, uuid, boolean, integer, uuid);

create or replace function public.record_sale(
  p_payment_method text,
  p_items jsonb,
  p_coupon_code text default null,
  p_discount_amount integer default 0,
  p_customer_phone text default null,
  p_customer_coupon_id uuid default null,
  p_use_customer_coupon boolean default true,
  p_use_points integer default 0,
  p_point_token uuid default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_store_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_promo record;
  v_unit_price integer;
  v_quantity integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_coupon record;
  v_customer_id uuid;
  v_is_new_customer boolean := false;
  -- record 대신 테이블 행 타입: 번호 없이 결제하거나 신규 고객이라 한 번도 조회하지 않은 경우에도
  -- .id를 읽을 수 있다(record면 "is not assigned yet" 오류로 결제가 실패했다 — 0024부터 있던 문제).
  v_customer_coupon public.customer_coupons;
  v_sale public.sales;
  v_policy public.point_policies;
  v_cust public.customers;
  v_paid integer;
  v_points integer := coalesce(p_use_points, 0);
  v_balance integer;
  v_earned integer := 0;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;
  if v_caller.store_id is null and v_caller.role <> 'admin' then
    raise exception '소속 매장이 없습니다';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception '판매 항목이 없습니다';
  end if;
  if v_points < 0 then
    raise exception '사용 포인트가 올바르지 않습니다';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    if v_product.id is null then
      raise exception '상품을 찾을 수 없습니다';
    end if;
    if v_store_id is null then
      v_store_id := v_product.store_id;
    elsif v_store_id <> v_product.store_id then
      raise exception '한 번에 한 매장의 상품만 판매할 수 있습니다';
    end if;
    if v_caller.role <> 'admin' and v_caller.store_id <> v_product.store_id then
      raise exception '다른 매장의 상품입니다';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception '수량은 1 이상이어야 합니다';
    end if;
    if v_product.stock_qty < v_quantity then
      raise exception '% 재고가 부족합니다', v_product.name;
    end if;

    select * into v_promo from public.promotions
      where product_id = v_product.id and active = true
        and now() >= starts_at and now() < ends_at
      order by created_at desc limit 1;
    if v_promo.id is not null then
      v_unit_price := case v_promo.discount_type
        when 'percent' then greatest(v_product.sell_price - (v_product.sell_price * v_promo.discount_value / 100), 0)
        else greatest(v_product.sell_price - v_promo.discount_value, 0)
      end;
    else
      v_unit_price := v_product.sell_price;
    end if;

    v_subtotal := v_subtotal + v_unit_price * v_quantity;
  end loop;

  v_discount := greatest(coalesce(p_discount_amount, 0), 0);

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
      where code = p_coupon_code and active = true;
    if v_coupon.id is null then
      raise exception '유효하지 않은 쿠폰입니다';
    end if;
    if v_coupon.discount_type = 'percent' then
      v_discount := v_discount + (v_subtotal * v_coupon.discount_value / 100);
    else
      v_discount := v_discount + v_coupon.discount_value;
    end if;
  end if;

  if p_customer_phone is not null and length(trim(p_customer_phone)) > 0 then
    select id into v_customer_id from public.customers
      where store_id = v_store_id and phone = trim(p_customer_phone);

    if v_customer_id is null then
      insert into public.customers (store_id, phone)
      values (v_store_id, trim(p_customer_phone))
      returning id into v_customer_id;
      v_is_new_customer := true;
    end if;

    if v_is_new_customer then
      v_discount := v_discount + least(500, greatest(v_subtotal - v_discount, 0));
    elsif coalesce(p_use_customer_coupon, true) then
      if p_customer_coupon_id is not null then
        select * into v_customer_coupon from public.customer_coupons
          where id = p_customer_coupon_id
            and customer_id = v_customer_id
            and redeemed_at is null
            and (expires_at is null or expires_at > now());
        if v_customer_coupon.id is null then
          raise exception '사용할 수 없는 쿠폰입니다';
        end if;
      else
        select * into v_customer_coupon from public.customer_coupons
          where customer_id = v_customer_id
            and redeemed_at is null
            and (expires_at is null or expires_at > now())
          order by expires_at nulls last
          limit 1;
      end if;

      if v_customer_coupon.id is not null then
        if v_customer_coupon.discount_type = 'percent' then
          v_discount := v_discount + (v_subtotal * v_customer_coupon.discount_value / 100);
        else
          v_discount := v_discount + v_customer_coupon.discount_value;
        end if;
      end if;
    end if;
  end if;

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;
  v_paid := v_subtotal - v_discount;

  -- 포인트 사용 검사
  if v_points > 0 then
    if v_customer_id is null then
      raise exception '포인트를 쓰려면 전화번호를 입력하세요';
    end if;
    select * into v_policy from public.point_policies where store_id = v_store_id;
    if v_policy.store_id is null or not v_policy.enabled then
      raise exception '이 매장은 포인트를 사용하지 않습니다';
    end if;
    select * into v_cust from public.customers where id = v_customer_id for update;
    v_balance := public._point_available(v_customer_id);
    if v_balance < v_policy.min_balance_to_use then
      raise exception '포인트는 %점 이상 모여야 쓸 수 있어요 (지금 %점)', v_policy.min_balance_to_use, v_balance;
    end if;
    if v_points % v_policy.use_unit <> 0 then
      raise exception '포인트는 %점 단위로 쓸 수 있어요', v_policy.use_unit;
    end if;
    if v_points > v_balance then
      raise exception '보유 포인트(%점)보다 많이 쓸 수 없어요', v_balance;
    end if;
    if v_points > floor(v_paid * v_policy.max_use_rate / 100.0) then
      raise exception '%', format('포인트는 결제금액의 %s%%까지 쓸 수 있어요 (최대 %s점)', v_policy.max_use_rate,
        (floor(v_paid * v_policy.max_use_rate / 100.0 / v_policy.use_unit) * v_policy.use_unit)::integer);
    end if;
    -- 금액 조건을 먼저 보고, 쓸 수 있을 때만 비밀번호 확인을 따진다
    if v_policy.require_pin then
      if p_point_token is null or v_cust.point_auth_token is distinct from p_point_token
         or v_cust.point_auth_expires is null or v_cust.point_auth_expires < now() then
        raise exception '포인트 비밀번호 확인이 필요합니다. 다시 확인해 주세요';
      end if;
    end if;
  end if;

  insert into public.sales (store_id, total_amount, payment_method, discount_amount, customer_id, created_by, points_used)
  values (v_store_id, v_paid - v_points, p_payment_method, v_discount, v_customer_id, auth.uid(), v_points)
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_promo from public.promotions
      where product_id = v_product.id and active = true
        and now() >= starts_at and now() < ends_at
      order by created_at desc limit 1;
    if v_promo.id is not null then
      v_unit_price := case v_promo.discount_type
        when 'percent' then greatest(v_product.sell_price - (v_product.sell_price * v_promo.discount_value / 100), 0)
        else greatest(v_product.sell_price - v_promo.discount_value, 0)
      end;
    else
      v_unit_price := v_product.sell_price;
    end if;

    insert into public.sale_items (sale_id, store_id, product_id, quantity, unit_price, subtotal, unit_cost)
    values (v_sale.id, v_store_id, v_product.id, v_quantity, v_unit_price, v_unit_price * v_quantity, v_product.cost_price);

    update public.products set stock_qty = stock_qty - v_quantity, updated_at = now()
    where id = v_product.id;
  end loop;

  if v_customer_coupon.id is not null then
    update public.customer_coupons
      set redeemed_at = now(), redeemed_sale_id = v_sale.id
      where id = v_customer_coupon.id;
  end if;

  -- 포인트 차감(토큰은 1회용이라 바로 지운다) → 남은 결제금액 기준 적립
  if v_points > 0 then
    perform public._point_consume(v_customer_id, v_points);
    insert into public.point_ledger (store_id, customer_id, sale_id, kind, amount, memo)
    values (v_store_id, v_customer_id, v_sale.id, 'use', -v_points, '결제에 사용');
    update public.customers set point_auth_token = null, point_auth_expires = null where id = v_customer_id;
  end if;

  if v_customer_id is not null then
    v_earned := public._point_earn(v_store_id, v_customer_id, v_sale.id, v_paid - v_points);
    if v_earned > 0 then
      update public.sales set points_earned = v_earned where id = v_sale.id returning * into v_sale;
    end if;
  end if;

  return v_sale;
end;
$$;

grant execute on function public.record_sale(text, jsonb, text, integer, text, uuid, boolean, integer, uuid) to authenticated;

-- ── 결제 후 적립(attach_customer_to_sale)에도 포인트 적립 ────────────
create or replace function public.attach_customer_to_sale(
  p_store_id uuid,
  p_sale_id uuid,
  p_customer_phone text
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_customer_id uuid;
  v_earned integer;
begin
  if length(v_phone) = 0 then
    raise exception '전화번호가 필요합니다';
  end if;

  select * into v_sale from public.sales
    where id = p_sale_id and store_id = p_store_id
    for update;
  if v_sale.id is null then
    raise exception '판매 기록을 찾을 수 없습니다';
  end if;
  if v_sale.customer_id is not null then
    raise exception '이미 적립된 결제입니다';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception '취소된 결제입니다';
  end if;
  if v_sale.created_at < now() - interval '30 minutes' then
    raise exception '결제 후 30분이 지나 적립할 수 없습니다';
  end if;

  select id into v_customer_id from public.customers
    where store_id = p_store_id and phone = v_phone;
  if v_customer_id is null then
    insert into public.customers (store_id, phone)
    values (p_store_id, v_phone)
    returning id into v_customer_id;
  end if;

  update public.sales set customer_id = v_customer_id
    where id = v_sale.id
    returning * into v_sale;

  v_earned := public._point_earn(p_store_id, v_customer_id, v_sale.id, v_sale.total_amount);
  if v_earned > 0 then
    update public.sales set points_earned = v_earned where id = v_sale.id returning * into v_sale;
  end if;
  return v_sale;
end;
$$;

revoke all on function public.attach_customer_to_sale(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.attach_customer_to_sale(uuid, uuid, text) to service_role;

-- ── 판매 취소 시 포인트 되돌리기 (판매 취소·배송 취소 공통) ────────────
create or replace function public._point_on_sale_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_lot record; v_take integer; v_policy public.point_policies;
begin
  if not (old.status = 'completed' and new.status = 'cancelled') or new.customer_id is null then
    return new;
  end if;
  if exists (select 1 from public.point_ledger where sale_id = new.id and kind in ('cancel_earn', 'cancel_use')) then
    return new; -- 이미 되돌림
  end if;

  -- 이 결제로 적립된 포인트 회수: 그 적립 건의 남은 양 → 모자라면 다른 적립 건에서
  for v_lot in select * from public.point_ledger where sale_id = new.id and kind = 'earn'
  loop
    v_take := public._point_consume(new.customer_id, v_lot.amount, v_lot.id);
    if v_take < v_lot.amount then
      v_take := v_take + public._point_consume(new.customer_id, v_lot.amount - v_take);
    end if;
    insert into public.point_ledger (store_id, customer_id, sale_id, kind, amount, memo)
    values (new.store_id, new.customer_id, new.id, 'cancel_earn', -v_take,
            case when v_take < v_lot.amount then format('결제 취소 — 적립 %s점 중 %s점 회수(이미 사용분 제외)', v_lot.amount, v_take)
                 else '결제 취소 — 적립 회수' end);
  end loop;

  -- 이 결제에 쓴 포인트 돌려주기 (새 유효기간)
  if new.points_used > 0 then
    select * into v_policy from public.point_policies where store_id = new.store_id;
    insert into public.point_ledger (store_id, customer_id, sale_id, kind, amount, remaining, expires_at, memo)
    values (new.store_id, new.customer_id, new.id, 'cancel_use', new.points_used, new.points_used,
            case when coalesce(v_policy.expire_months, 12) > 0 then now() + make_interval(months => coalesce(v_policy.expire_months, 12)) end,
            '결제 취소 — 사용 포인트 반환');
  end if;
  return new;
end; $$;

revoke all on function public._point_on_sale_cancel() from public, anon, authenticated;

drop trigger if exists sales_point_cancel on public.sales;
create trigger sales_point_cancel after update of status on public.sales
  for each row execute function public._point_on_sale_cancel();
