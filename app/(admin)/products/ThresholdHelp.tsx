import { COVER_DAYS, SALES_WINDOW_DAYS } from "@/lib/order-recommendation";
import { THRESHOLD_WINDOW_DAYS } from "@/lib/threshold-from-sales";
import ThresholdRecalcButton from "./ThresholdRecalcButton";

// 상품 조회·재고소진상품 화면에 붙는 "적정재고" 설명 + 지금 다시 계산 버튼.
export default function ThresholdHelp() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl">
          <b className="text-zinc-800">적정재고</b>는 판매 통계상 우리 매장에 늘 두었으면 좋은 수량이에요.{" "}
          <b className="text-zinc-800">최근 {THRESHOLD_WINDOW_DAYS}일 동안 팔린 수량</b>으로 상품마다
          자동 계산되고, <b className="text-zinc-800">매일 새벽 3시</b>에 새로 반영돼요. 재고가 적정재고
          이하로 떨어지면 재고소진상품에 표시돼요.
        </p>
        <ThresholdRecalcButton />
      </div>
      <details>
        <summary className="cursor-pointer font-medium text-zinc-700">자세히 보기 — 계산 방법과 예외</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>
            예: 최근 {THRESHOLD_WINDOW_DAYS}일 동안 컵라면이 18개 팔렸다면 적정재고는 <b>18개</b>예요. 취소된
            판매는 빼고 셉니다.
          </li>
          <li>
            최근 {THRESHOLD_WINDOW_DAYS}일 동안 한 번도 안 팔린 상품은 값을 바꾸지 않고 <b>기존 값을 그대로</b>{" "}
            둬요(0으로 만들면 재고가 다 떨어져도 알림이 안 뜨기 때문). 이런 상품은 처음 등록할 때
            넣은 값(기본 5개)이 유지돼요.
          </li>
          <li>
            상품 수정 화면에서 직접 바꿀 수도 있지만, 판매가 있는 상품은 다음 날 새벽 판매량 기준으로
            다시 바뀌어요.
          </li>
          <li>
            &quot;적정재고 지금 다시 계산&quot; 버튼을 누르면 새벽까지 기다리지 않고 바로 반영돼요.
          </li>
          <li>
            <b>발주 추천과의 관계:</b> 추천 수량은 적정재고와 &quot;최근 {SALES_WINDOW_DAYS}일 하루 평균 ×{" "}
            {COVER_DAYS}일치&quot; 중 큰 쪽까지 채우도록 계산해요. 지난 한 주만 유난히 적게 팔렸어도 한 달
            평균이 높으면 그만큼 추천돼요.
          </li>
        </ul>
      </details>
    </div>
  );
}
