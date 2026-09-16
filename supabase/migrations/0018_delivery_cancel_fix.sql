-- 배송주문 취소 버그 수정: cancelDelivery를 눌러도 재고가 원복되지 않고
-- sales.status도 'completed'로 남아 매출에 그대로 잡히고 있었다. cancel_sale
-- (일반 판매 취소)과 동일하게, 배송주문이 취소되면 판매 자체도 취소 처리하고
-- 판매됐던 수량만큼 재고를 되돌려준다.
create or replace function public.set_delivery_status(p_sale_id uuid, p_status text)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller record;
  v_sale public.sales;
  v_current text;
  v_allowed text[];
  v_item record;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null or not v_sale.is_delivery then
    raise exception '배송주문을 찾을 수 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> v_sale.store_id then
    raise exception '다른 매장의 주문입니다';
  end if;

  v_current := coalesce(v_sale.delivery_status, 'requested');
  v_allowed := case v_current
    when 'requested' then array['preparing', 'cancelled']
    when 'preparing' then array['out_for_delivery']
    when 'out_for_delivery' then array['delivered']
    else array[]::text[]
  end;
  if not (p_status = any(v_allowed)) then
    raise exception '% 상태에서는 %(으)로 바꿀 수 없습니다', v_current, p_status;
  end if;

  if p_status = 'cancelled' then
    for v_item in select * from public.sale_items where sale_id = p_sale_id
    loop
      update public.products set stock_qty = stock_qty + v_item.quantity, updated_at = now()
      where id = v_item.product_id;
    end loop;

    update public.sales set delivery_status = p_status, status = 'cancelled' where id = p_sale_id
    returning * into v_sale;
  else
    update public.sales set delivery_status = p_status where id = p_sale_id
    returning * into v_sale;
  end if;

  return v_sale;
end;
$$;
