-- 매장 간 재고이동 — 매장을 여러 개 가진 점주가 소비기한 임박 상품이나 많이 사입한 재고를
-- 다른 매장으로 나눌 때, 지금은 A매장에서 재고조정으로 빼고 B매장에서 입고로 따로 등록하던
-- 것을 한 번에 처리한다(누락·등록 실수 방지).
--
-- 바코드 + 수량 + 받는 매장만 정하면:
--   A매장 재고 차감 → B매장 재고 증가(B매장에 그 바코드 상품이 없으면 A매장 상품 정보로 자동 생성)
--   → 소비기한을 고르면 그 소비기한 묶음도 같이 옮김 → 이동 내역 기록
-- 을 하나의 트랜잭션으로 처리한다(중간에 실패하면 전부 취소).
--
-- ⚠️ 권한: 지금은 역할이 admin/staff뿐이라 여러 매장에 접근할 수 있는 admin만 실행할 수 있다.
-- 본사/점주/직원 역할을 나누면(인수인계서 3번) "그 점주가 가진 매장끼리"로 범위를 바꾸면 된다.

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  from_store_id uuid not null references public.stores (id),
  to_store_id uuid not null references public.stores (id),
  from_product_id uuid not null references public.products (id),
  to_product_id uuid not null references public.products (id),
  barcode text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  expiry_date date,
  reason text not null check (reason in ('expiry', 'overstock', 'request', 'other')),
  memo text,
  -- 받는 매장에 상품이 없어 이번 이동으로 새로 만들어졌는지
  created_product boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (from_store_id <> to_store_id)
);

create index stock_transfers_from_idx on public.stock_transfers (from_store_id, created_at desc);
create index stock_transfers_to_idx on public.stock_transfers (to_store_id, created_at desc);

alter table public.stock_transfers enable row level security;

create policy "stock_transfers admin select" on public.stock_transfers for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "stock_transfers staff select" on public.stock_transfers for select
  using (
    from_store_id = (select store_id from public.current_profile())
    or to_store_id = (select store_id from public.current_profile())
  );

create function public.transfer_stock(
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_barcode text,
  p_quantity integer,
  p_reason text,
  p_expiry_date date default null,
  p_memo text default null
)
returns public.stock_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_from public.products;
  v_to public.products;
  v_created boolean := false;
  v_lot record;
  v_remaining integer;
  v_take integer;
  v_row public.stock_transfers;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is distinct from 'admin' then
    raise exception '매장 간 재고이동은 여러 매장을 관리하는 계정만 할 수 있습니다';
  end if;
  if p_from_store_id = p_to_store_id then
    raise exception '보내는 매장과 받는 매장이 같습니다';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '수량은 1 이상이어야 합니다';
  end if;
  if p_reason not in ('expiry', 'overstock', 'request', 'other') then
    raise exception '사유가 올바르지 않습니다';
  end if;
  if not exists (select 1 from public.stores where id = p_to_store_id) then
    raise exception '받는 매장을 찾을 수 없습니다';
  end if;

  -- 동시에 같은 상품을 옮기거나 파는 경우를 막기 위해 보내는 상품 행을 잠근다.
  select * into v_from from public.products
    where store_id = p_from_store_id and barcode = p_barcode
    for update;
  if v_from.id is null then
    raise exception '보내는 매장에 바코드 % 상품이 없습니다', p_barcode;
  end if;
  if v_from.stock_qty < p_quantity then
    raise exception '재고가 부족합니다 (현재 %개, 이동 %개)', v_from.stock_qty, p_quantity;
  end if;

  select * into v_to from public.products
    where store_id = p_to_store_id and barcode = p_barcode
    for update;
  if v_to.id is null then
    -- 받는 매장에 없는 상품이면 보내는 매장의 상품 정보를 그대로 복사해 만든다(재고 0에서 시작).
    insert into public.products (
      store_id, barcode, name, origin, category_id, is_tax_exempt, cost_price, sell_price,
      stock_qty, low_stock_threshold, image_url
    ) values (
      p_to_store_id, v_from.barcode, v_from.name, v_from.origin, v_from.category_id, v_from.is_tax_exempt,
      v_from.cost_price, v_from.sell_price, 0, v_from.low_stock_threshold, v_from.image_url
    )
    returning * into v_to;
    v_created := true;
  end if;

  update public.products set stock_qty = stock_qty - p_quantity, updated_at = now() where id = v_from.id;
  update public.products set stock_qty = stock_qty + p_quantity, updated_at = now() where id = v_to.id;

  -- 소비기한을 지정했으면 그 날짜 묶음에서 옮긴 수량만큼 빼서 받는 매장에 같은 날짜로 등록한다.
  if p_expiry_date is not null then
    v_remaining := p_quantity;
    for v_lot in
      select id, quantity from public.product_expiries
      where product_id = v_from.id and expiry_date = p_expiry_date
      order by created_at
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_lot.quantity, v_remaining);
      if v_take = v_lot.quantity then
        delete from public.product_expiries where id = v_lot.id;
      else
        update public.product_expiries set quantity = quantity - v_take where id = v_lot.id;
      end if;
      v_remaining := v_remaining - v_take;
    end loop;

    insert into public.product_expiries (store_id, product_id, expiry_date, quantity, created_by)
    values (p_to_store_id, v_to.id, p_expiry_date, p_quantity, auth.uid());
  end if;

  insert into public.stock_transfers (
    from_store_id, to_store_id, from_product_id, to_product_id, barcode, product_name,
    quantity, expiry_date, reason, memo, created_product, created_by
  ) values (
    p_from_store_id, p_to_store_id, v_from.id, v_to.id, v_from.barcode, v_from.name,
    p_quantity, p_expiry_date, p_reason, nullif(trim(coalesce(p_memo, '')), ''), v_created, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.transfer_stock(uuid, uuid, text, integer, text, date, text) to authenticated;
