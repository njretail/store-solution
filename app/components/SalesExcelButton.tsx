"use client";

import * as XLSX from "xlsx";

type Row = {
  일시: string;
  상품: string;
  결제수단: string;
  할인: number;
  결제금액: number;
  판매상태: string;
};

export default function SalesExcelButton({ rows, fileLabel }: { rows: Row[]; fileLabel: string }) {
  function download() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "판매내역");
    XLSX.writeFile(wb, `${fileLabel}.xlsx`);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
    >
      엑셀 다운로드
    </button>
  );
}
