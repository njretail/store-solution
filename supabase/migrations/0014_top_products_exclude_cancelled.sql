-- top_products가 취소된 판매(sales.status = 'cancelled')까지 매출/수량에 포함시키고 있던
-- 버그 수정. 취소해도 sale_items는 그대로 남아있는 구조라(0010_sale_status.sql 참고)
-- 반드시 sales.status로 걸러야 한다 — 상품 조회/재고소진상품의 ABC등급, 대시보드
-- "잘나가는 상품", 신설 상품통계 페이지가 모두 이 함수를 쓰므로 여기서 한 번에 고친다.
create or replace function public.top_products(
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
      and s.status = 'completed'
      and s.created_at >= p_from
      and s.created_at < p_to
    group by si.product_id, p.name
    order by sum(si.quantity) desc
    limit p_limit;
end;
$$;
