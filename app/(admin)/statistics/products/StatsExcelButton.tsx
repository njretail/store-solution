"use client";

import * as XLSX from "xlsx";
import type { ProductRankRow } from "@/lib/product-stats";

export default function StatsExcelButton({
  rows,
  fileLabel,
}: {
  rows: ProductRankRow[];
  fileLabel: string;
}) {
  function download() {
    const sheetRows = rows.map((r, i) => ({
      순위: i + 1,
      등급: r.grade,
      상품명: r.name,
      카테고리: r.category,
      판매수량: r.quantity,
      매출액: r.revenue,
      "매출비중(%)": Math.round(r.sharePercent * 10) / 10,
      "누적비중(%)": Math.round(r.cumulativePercent * 10) / 10,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품통계");
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
