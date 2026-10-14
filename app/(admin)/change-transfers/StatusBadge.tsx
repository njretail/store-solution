import type { ChangeTransferStatus } from "@/lib/types";

const LABELS: Record<ChangeTransferStatus, string> = {
  pending: "미처리",
  paid: "완료",
  cancelled: "취소",
};

const STYLES: Record<ChangeTransferStatus, string> = {
  pending: "border-red-400 text-red-600",
  paid: "border-green-500 text-green-700",
  cancelled: "border-zinc-300 text-zinc-500",
};

export function StatusBadge({ status }: { status: ChangeTransferStatus }) {
  return (
    <span className={`rounded-full border bg-white px-3 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
