"use client";

// 어떤 체크박스 그룹이든(자동발주, 전체 발주 선택 등) 한 번에 켜거나 끄기 위한
// 헤더 체크박스. 실제 저장/제출은 하지 않고 화면의 체크 상태만 일괄로 맞춰준다.
export default function SelectAllCheckbox({
  selector = "input[data-auto-order-checkbox]",
}: {
  selector?: string;
}) {
  return (
    <input
      type="checkbox"
      title="전체 선택"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(selector).forEach((cb) => {
          cb.checked = e.target.checked;
        });
      }}
      className="h-3.5 w-3.5 rounded border-zinc-300"
    />
  );
}
