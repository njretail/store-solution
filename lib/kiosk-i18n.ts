// 키오스크 화면(구매자용, /kiosk/[id])의 시스템 문구(버튼·안내 라벨) 다국어 사전.
// 관리자가 직접 입력하는 콘텐츠(배너/공지/안내멘트 문구)는 번역하지 않는다 — 입력한
// 그대로 노출된다(자동번역 API 연동 전까지는 그 문구 자체를 여러 언어로 등록하는
// 기능이 없다는 뜻. 필요해지면 kiosk_announcements/kiosks에 언어별 컬럼을 추가하거나
// 번역 API를 붙이는 식으로 확장).
export type KioskLang = "ko" | "en" | "zh" | "ja";

export const KIOSK_LANG_LABELS: Record<KioskLang, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  ja: "日本語",
};

export const KIOSK_LANGS: KioskLang[] = ["ko", "en", "zh", "ja"];

type KioskStringKey =
  | "tapToStart"
  | "maintenanceTitle"
  | "maintenanceBody"
  | "offlineTitle"
  | "changeRequestButton"
  | "boardFind"
  | "boardClose"
  | "boardInstruction"
  | "changeRequestTitle"
  | "changeRequestSubtitle"
  | "amountLabel"
  | "amountPlaceholder"
  | "bankNameLabel"
  | "accountNumberLabel"
  | "accountHolderLabel"
  | "phoneLabel"
  | "submit"
  | "submitting"
  | "doneTitle"
  | "doneBody";

export const KIOSK_STRINGS: Record<KioskLang, Record<KioskStringKey, string>> = {
  ko: {
    tapToStart: "화면을 터치하여 시작하세요",
    maintenanceTitle: "점검 중입니다",
    maintenanceBody: "잠시 후 다시 이용해 주세요.",
    offlineTitle: "일시 이용 불가",
    changeRequestButton: "거스름돈 부족 · 계좌로 받기",
    boardFind: "바코드 없는 상품 찾기",
    boardClose: "닫기",
    boardInstruction: "바코드가 없는 상품은 아래 바코드를 스캔해 주세요",
    changeRequestTitle: "거스름돈 계좌로 받기",
    changeRequestSubtitle: "받지 못한 거스름돈을 입력하신 계좌로 보내드립니다.",
    amountLabel: "받지 못한 금액",
    amountPlaceholder: "예: 1500",
    bankNameLabel: "은행명",
    accountNumberLabel: "계좌번호",
    accountHolderLabel: "예금주",
    phoneLabel: "연락처 (선택)",
    submit: "등록하기",
    submitting: "등록 중...",
    doneTitle: "등록되었습니다",
    doneBody: "입력하신 계좌로 확인 후 입금해 드립니다.",
  },
  en: {
    tapToStart: "Touch the screen to start",
    maintenanceTitle: "Under maintenance",
    maintenanceBody: "Please try again shortly.",
    offlineTitle: "Temporarily unavailable",
    changeRequestButton: "Short on change? Get a bank transfer",
    boardFind: "Find a barcode-less item",
    boardClose: "Close",
    boardInstruction: "For items without a barcode, scan the barcode below",
    changeRequestTitle: "Receive change by bank transfer",
    changeRequestSubtitle: "We'll send the change you didn't receive to your account.",
    amountLabel: "Amount not received",
    amountPlaceholder: "e.g. 1500",
    bankNameLabel: "Bank name",
    accountNumberLabel: "Account number",
    accountHolderLabel: "Account holder",
    phoneLabel: "Phone (optional)",
    submit: "Submit",
    submitting: "Submitting...",
    doneTitle: "Submitted",
    doneBody: "We'll verify and transfer the amount to your account.",
  },
  zh: {
    tapToStart: "请触摸屏幕开始",
    maintenanceTitle: "维护中",
    maintenanceBody: "请稍后再试。",
    offlineTitle: "暂时无法使用",
    changeRequestButton: "找零不足·转账领取",
    boardFind: "查找无条码商品",
    boardClose: "关闭",
    boardInstruction: "没有条码的商品请扫描下方条码",
    changeRequestTitle: "通过转账领取找零",
    changeRequestSubtitle: "我们会将未收到的找零转到您的账户。",
    amountLabel: "未收到的金额",
    amountPlaceholder: "例如：1500",
    bankNameLabel: "银行名称",
    accountNumberLabel: "账号",
    accountHolderLabel: "账户持有人",
    phoneLabel: "联系电话（可选）",
    submit: "提交",
    submitting: "提交中...",
    doneTitle: "已提交",
    doneBody: "确认后会将款项转入您的账户。",
  },
  ja: {
    tapToStart: "画面にタッチして開始してください",
    maintenanceTitle: "メンテナンス中です",
    maintenanceBody: "しばらくしてから再度お試しください。",
    offlineTitle: "一時的にご利用いただけません",
    changeRequestButton: "お釣り不足・口座で受け取る",
    boardFind: "バーコードのない商品を探す",
    boardClose: "閉じる",
    boardInstruction: "バーコードのない商品は下のバーコードをスキャンしてください",
    changeRequestTitle: "お釣りを口座で受け取る",
    changeRequestSubtitle: "お受け取りいただけなかったお釣りをご入力の口座にお振込みします。",
    amountLabel: "未受領金額",
    amountPlaceholder: "例：1500",
    bankNameLabel: "銀行名",
    accountNumberLabel: "口座番号",
    accountHolderLabel: "口座名義",
    phoneLabel: "連絡先（任意）",
    submit: "登録する",
    submitting: "登録中...",
    doneTitle: "登録されました",
    doneBody: "確認後、ご登録の口座にお振込みします。",
  },
};
