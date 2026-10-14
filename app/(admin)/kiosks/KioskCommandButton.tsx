"use client";

import { sendKioskCommand } from "./actions";

// 원격 명령 버튼 — 확인 창(confirm)이 필요한 명령(기기 종료 등)이 있어 클라이언트 컴포넌트로 분리.
// (서버 컴포넌트에서는 onSubmit 같은 이벤트 핸들러를 쓸 수 없다)
export default function KioskCommandButton({
  kioskId,
  command,
  label,
  confirmMessage,
  className,
}: {
  kioskId: string;
  command: string;
  label: string;
  confirmMessage?: string;
  className: string;
}) {
  return (
    <form
      action={sendKioskCommand}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={kioskId} />
      <input type="hidden" name="command" value={command} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
