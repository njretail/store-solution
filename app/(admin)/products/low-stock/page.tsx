import { redirect } from "next/navigation";

// 재고소진상품 화면은 상품 조회 안으로 합쳐졌다. 예전 링크(북마크 등) 호환을 위해
// 새 위치로 리다이렉트만 해준다.
export default function LowStockRedirect() {
  redirect("/products?view=low-stock");
}
