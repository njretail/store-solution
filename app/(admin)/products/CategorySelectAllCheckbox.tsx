"use client";

// 분류(카테고리) 제목 옆 체크박스 — 켜면 그 분류 안의 모든 상품 자동발주 체크박스가
// 한 번에 켜지고, 끄면 한 번에 꺼진다. summary(분류 제목) 안에 있어서 클릭이
// details 아코디언을 여닫는 걸로 새지 않게 stopPropagation을 걸어둔다.
export default function CategorySelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      title="이 분류 전체선택"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const details = e.target.closest("details");
        if (!details) return;
        details
          .querySelectorAll<HTMLInputElement>("input[data-auto-order-checkbox]")
          .forEach((cb) => {
            cb.checked = e.target.checked;
          });
      }}
      className="h-3.5 w-3.5 rounded border-zinc-300"
    />
  );
}
