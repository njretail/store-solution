// Supabase(PostgREST)는 명시적 limit/range가 없어도 기본 1000행까지만 반환한다.
// 상품이 1000개를 넘는 매장에서 "매장 전체 상품 목록"을 쓰는 화면(매입 매칭, 상품 조회,
// 재고소진상품 등)이 뒤쪽 상품을 조용히 누락하지 않도록, range()로 나눠서 전체를 모아온다.
// 페이지당 컬럼 구성이 화면마다 달라서 쿼리 자체는 호출부에서 만들고, 여기서는 range만 반복한다.
export async function fetchAllPages<T>(
  pageFetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await pageFetch(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
