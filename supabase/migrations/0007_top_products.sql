-- 무인편의점 관리자페이지 7차 확장 스키마 (홈 화면 잘나가는 상품 순위)
-- 0001~0006 실행 이후, Supabase SQL Editor에서 실행하세요.

create function public.top_products(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (product_id uuid, name text, quantity bigint, revenue bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_caller record;
begin
  select * into v_caller from public.current_profile();
  if v_caller.role is null then
    raise exception '권한이 없습니다';
  end if;
  if v_caller.role <> 'admin' and v_caller.store_id <> p_store_id then
    raise exception '다른 매장의 데이터입니다';
  end if;

  return query
    select si.product_id, p.name, sum(si.quantity)::bigint, sum(si.subtotal)::bigint
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    join public.products p on p.id = si.product_id
    where si.store_id = p_store_id
      and s.created_at >= p_from
      and s.created_at < p_to
    group by si.product_id, p.name
    order by sum(si.quantity) desc
    limit p_limit;
end;
$$;

grant execute on function public.top_products(uuid, timestamptz, timestamptz, integer) to authenticated;
