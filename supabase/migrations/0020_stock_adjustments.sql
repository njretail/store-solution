-- 재고조정(폐기/반품/분실 등) — 오더인 매뉴얼의 "입고내역 관리(폐기, 반품, 삭제 처리)"
-- + "재고 손실 내역 조회"에 해당하는 기능. 지금까지는 입고(재고를 늘리는 방향)만
-- 있었고 반대 방향(재고를 줄이는 사유 기록)이 없었다. record_stock_in과 대칭되는
-- 구조로 만든다.
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  reason text not null check (reason in ('disposal', 'return', 'loss', 'other')),
  memo text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.stock_adjustments enable row level security;

create policy "stock_adjustments admin select" on public.stock_adjustments for select
  using (exists (select 1 from public.current_profile() cp where cp.role = 'admin'));
create policy "stock_adjustments staff select" on public.stock_adjustments for select
  using (store_id = (select store_id from public.current_profile()));

-- 재고 차감 기록: stock_adjustments insert + 재고 감소를 원자적으로 처리.
-- record_stock_in과 동일한 권한 검사, 반대 방향으로 재고를 움직인다.
create function public.record_stock_adjustment(
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_memo text default null
)
returns public.stock_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_store_id uuid;
  v_stock_qty integer;
  v_row public.stock_adjustments;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;

  select store_id, stock_qty into v_store_id, v_stock_qty
    from public.products where id = p_product_id;
  if v_store_id is null then
    raise exception '상품을 찾을 수 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> v_store_id then
    raise exception '다른 매장의 상품입니다';
  end if;
  if p_quantity <= 0 then
    raise exception '수량은 1 이상이어야 합니다';
  end if;
  if p_reason not in ('disposal', 'return', 'loss', 'other') then
    raise exception '사유가 올바르지 않습니다';
  end if;
  if v_stock_qty < p_quantity then
    raise exception '현재 재고(%)보다 많은 수량을 차감할 수 없습니다', v_stock_qty;
  end if;

  insert into public.stock_adjustments (store_id, product_id, quantity, reason, memo, created_by)
  values (v_store_id, p_product_id, p_quantity, p_reason, p_memo, auth.uid())
  returning * into v_row;

  update public.products set stock_qty = stock_qty - p_quantity, updated_at = now()
  where id = p_product_id;

  return v_row;
end;
$$;

grant execute on function public.record_stock_adjustment(uuid, integer, text, text) to authenticated;
