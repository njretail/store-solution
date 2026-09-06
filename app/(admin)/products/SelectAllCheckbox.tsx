"use client";

// 자동발주 열의 개별 체크박스를 한 번에 켜거나 끄기 위한 헤더 체크박스.
// 실제 저장은 하지 않고 화면의 체크 상태만 일괄로 맞춰준다 — 저장은 아래
// "자동발주 설정 저장" 버튼을 눌러야 반영된다.
export default function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      title="전체 선택"
      onChange={(e) => {
        document
          .querySelectorAll<HTMLInputElement>("input[data-auto-order-checkbox]")
          .forEach((cb) => {
            cb.checked = e.target.checked;
          });
      }}
      className="h-3.5 w-3.5 rounded border-zinc-300"
    />
  );
}
