"use client";

import { useActionState } from "react";
import { syncAutoOrderEnabled, type AutoOrderState } from "./actions";

const initialState: AutoOrderState = { error: null, success: null };

// 상품 조회 화면들의 자동발주 체크박스는 이 컴포넌트가 렌더링하는 <form id={formId}>를
// form={formId} 속성으로 원격 연결한다(표 전체를 form으로 감쌀 수 없어서 — ProductOrderCell이
// 행마다 자체 <form>을 갖고 있어 중첩된 form이 되기 때문). 여기서는 그 form 자체와
// 저장 버튼/결과 메시지를 담당한다. 화면마다 form id가 달라서(재고소진상품 뷰/전체목록 뷰가
// 별도 체크박스 세트를 가짐) formId를 prop으로 받는다.
export default function AutoOrderForm({ formId }: { formId: string }) {
  const [state, formAction, pending] = useActionState(syncAutoOrderEnabled, initialState);

  return (
    <div className="flex w-fit flex-col gap-2">
      <form id={formId} action={formAction} />
      <button
        type="submit"
        form={formId}
        disabled={pending}
        className="w-fit rounded-lg bg-[#C8075F] px-4 py-2 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
      >
        {pending ? "저장 중..." : "자동발주 설정 저장"}
      </button>
      {!pending && state.success && <p className="text-sm text-green-600">{state.success}</p>}
      {!pending && state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
