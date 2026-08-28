-- 판매내역 상세/취소 기능을 위한 확장 스키마
-- 0009_product_images.sql 실행 이후, Supabase SQL Editor에서 실행하세요.

-- 판매 상태(정상/취소)
alter table public.sales
  add column if not exists status text not null default 'completed'
    check (status in ('completed', 'cancelled'));

-- 판매 취소: 재고를 원복하고 상태를 cancelled로 바꾼다. 이미 취소된 건은 다시 취소할 수 없다.
create function public.cancel_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_sale public.sales;
  v_item record;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then
    raise exception '판매 내역을 찾을 수 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> v_sale.store_id then
    raise exception '다른 매장의 판매 내역입니다';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception '이미 취소된 판매입니다';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id
  loop
    update public.products set stock_qty = stock_qty + v_item.quantity, updated_at = now()
    where id = v_item.product_id;
  end loop;

  update public.sales set status = 'cancelled' where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

grant execute on function public.cancel_sale(uuid) to authenticated;
