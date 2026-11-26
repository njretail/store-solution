// 손님에게 안내하는 고객센터 정보 (키오스크·판매 화면·키오스크 API 공통). 바뀌면 여기만 고치면 된다.
export const CUSTOMER_CENTER = {
  phone: "1522-1750",
  tel: "15221750",
  hours: "오전 10시 ~ 오후 5시",
} as const;

export const CUSTOMER_CENTER_LINE = `고객센터 ${CUSTOMER_CENTER.phone} (${CUSTOMER_CENTER.hours})`;
