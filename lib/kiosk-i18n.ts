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
  | "reasonTitle"
  | "reasonShortage"
  | "reasonShortageDesc"
  | "reasonError"
  | "reasonErrorDesc"
  | "transferOnlyNote"
  | "amountLabel"
  | "amountPlaceholder"
  | "bankNameLabel"
  | "bankSelectPlaceholder"
  | "accountNumberLabel"
  | "accountNumberPlaceholder"
  | "accountConfirmLabel"
  | "accountMismatch"
  | "noNameNote"
  | "consentTitle"
  | "consentPurposeLabel"
  | "consentPurpose"
  | "consentItemsLabel"
  | "consentItems"
  | "consentRetentionLabel"
  | "consentRetention"
  | "consentRefusalLabel"
  | "consentRefusal"
  | "consentAgree"
  | "back"
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
    changeRequestButton: "거스름돈 못 받으셨나요? 계좌로 받기",
    boardFind: "바코드 없는 상품 찾기",
    boardClose: "닫기",
    boardInstruction: "바코드가 없는 상품은 아래 바코드를 스캔해 주세요",
    changeRequestTitle: "거스름돈 계좌로 받기",
    changeRequestSubtitle: "받지 못한 거스름돈을 입력하신 계좌로 보내드립니다.",
    reasonTitle: "어떤 상황인가요?",
    reasonShortage: "잔돈이 부족해서 못 받았어요",
    reasonShortageDesc: "기기에 거스름돈이 모자라 전부 또는 일부를 받지 못한 경우",
    reasonError: "기기 오류로 못 받았어요",
    reasonErrorDesc: "잔돈은 있었지만 배출 오류 등으로 거스름돈이 나오지 않은 경우",
    transferOnlyNote: "받지 못한 거스름돈은 계좌이체로만 돌려드립니다.",
    amountLabel: "받지 못한 금액(원)",
    amountPlaceholder: "예: 1500",
    bankNameLabel: "은행",
    bankSelectPlaceholder: "은행을 선택하세요",
    accountNumberLabel: "계좌번호",
    accountNumberPlaceholder: "숫자만 입력 ('-' 없이)",
    accountConfirmLabel: "계좌번호 확인(한 번 더 입력)",
    accountMismatch: "계좌번호가 서로 다릅니다. 다시 확인해 주세요.",
    noNameNote: "이름·연락처는 받지 않습니다. 은행과 계좌번호만 입력해 주세요.",
    consentTitle: "개인정보 수집·이용 동의 (필수)",
    consentPurposeLabel: "수집·이용 목적",
    consentPurpose: "받지 못한 거스름돈의 계좌 송금",
    consentItemsLabel: "수집 항목",
    consentItems: "은행명, 계좌번호",
    consentRetentionLabel: "보유·이용 기간",
    consentRetention: "송금 완료 또는 요청 취소 시 즉시 파기 (정산 확인을 위해 계좌번호 끝 4자리만 보관)",
    consentRefusalLabel: "동의 거부 권리",
    consentRefusal: "동의를 거부할 수 있으며, 거부 시 계좌 송금을 받으실 수 없습니다. 이 경우 매장에 안내된 연락처로 문의해 주세요.",
    consentAgree: "위 내용을 확인했으며 개인정보 수집·이용에 동의합니다.",
    back: "이전",
    submit: "계좌로 받기 신청",
    submitting: "등록 중...",
    doneTitle: "신청되었습니다",
    doneBody: "매장에서 확인 후 입력하신 계좌로 송금해 드립니다. 송금이 끝나면 계좌번호는 즉시 파기됩니다.",
  },
  en: {
    tapToStart: "Touch the screen to start",
    maintenanceTitle: "Under maintenance",
    maintenanceBody: "Please try again shortly.",
    offlineTitle: "Temporarily unavailable",
    changeRequestButton: "Didn't get your change? Get a bank transfer",
    boardFind: "Find a barcode-less item",
    boardClose: "Close",
    boardInstruction: "For items without a barcode, scan the barcode below",
    changeRequestTitle: "Receive change by bank transfer",
    changeRequestSubtitle: "We'll send the change you didn't receive to your account.",
    reasonTitle: "What happened?",
    reasonShortage: "The machine was out of change",
    reasonShortageDesc: "The machine didn't have enough change to return all or part of it",
    reasonError: "The machine had an error",
    reasonErrorDesc: "There was change, but it wasn't dispensed due to a machine error",
    transferOnlyNote: "Unreturned change is refunded by bank transfer only.",
    amountLabel: "Amount not received (KRW)",
    amountPlaceholder: "e.g. 1500",
    bankNameLabel: "Bank",
    bankSelectPlaceholder: "Select your bank",
    accountNumberLabel: "Account number",
    accountNumberPlaceholder: "Digits only (no '-')",
    accountConfirmLabel: "Confirm account number",
    accountMismatch: "The account numbers don't match. Please check again.",
    noNameNote: "We don't collect your name or phone number — only bank and account number.",
    consentTitle: "Consent to collection and use of personal information (required)",
    consentPurposeLabel: "Purpose",
    consentPurpose: "Transferring the change you didn't receive",
    consentItemsLabel: "Items collected",
    consentItems: "Bank name, account number",
    consentRetentionLabel: "Retention period",
    consentRetention: "Deleted immediately once the transfer is completed or the request is cancelled (only the last 4 digits are kept for settlement)",
    consentRefusalLabel: "Right to refuse",
    consentRefusal: "You may refuse, but then we can't transfer the change. In that case, please contact the store using the number posted in the store.",
    consentAgree: "I have read the above and agree to the collection and use of my personal information.",
    back: "Back",
    submit: "Request bank transfer",
    submitting: "Submitting...",
    doneTitle: "Request submitted",
    doneBody: "The store will verify and transfer the amount to your account. Your account number is deleted right after the transfer.",
  },
  zh: {
    tapToStart: "请触摸屏幕开始",
    maintenanceTitle: "维护中",
    maintenanceBody: "请稍后再试。",
    offlineTitle: "暂时无法使用",
    changeRequestButton: "没收到找零？转账领取",
    boardFind: "查找无条码商品",
    boardClose: "关闭",
    boardInstruction: "没有条码的商品请扫描下方条码",
    changeRequestTitle: "通过转账领取找零",
    changeRequestSubtitle: "我们会将未收到的找零转到您的账户。",
    reasonTitle: "发生了什么情况？",
    reasonShortage: "机器零钱不足",
    reasonShortageDesc: "机器零钱不够，未能找回全部或部分找零",
    reasonError: "机器故障",
    reasonErrorDesc: "机器有零钱，但因出钞故障等原因没有找零",
    transferOnlyNote: "未收到的找零仅通过银行转账退还。",
    amountLabel: "未收到的金额（韩元）",
    amountPlaceholder: "例如：1500",
    bankNameLabel: "银行",
    bankSelectPlaceholder: "请选择银行",
    accountNumberLabel: "账号",
    accountNumberPlaceholder: "仅输入数字（不含'-'）",
    accountConfirmLabel: "再次输入账号",
    accountMismatch: "两次输入的账号不一致，请重新确认。",
    noNameNote: "我们不收集姓名和电话，只需输入银行和账号。",
    consentTitle: "同意收集和使用个人信息（必选）",
    consentPurposeLabel: "收集和使用目的",
    consentPurpose: "将未收到的找零转入账户",
    consentItemsLabel: "收集项目",
    consentItems: "银行名称、账号",
    consentRetentionLabel: "保存和使用期限",
    consentRetention: "转账完成或申请取消后立即销毁（为核对结算仅保留账号后4位）",
    consentRefusalLabel: "拒绝同意的权利",
    consentRefusal: "您可以拒绝同意，但拒绝后将无法通过转账领取找零。此时请通过店内公示的联系方式咨询。",
    consentAgree: "我已确认以上内容，并同意收集和使用个人信息。",
    back: "上一步",
    submit: "申请转账领取",
    submitting: "提交中...",
    doneTitle: "已提交申请",
    doneBody: "门店确认后会将款项转入您的账户。转账完成后，账号将立即销毁。",
  },
  ja: {
    tapToStart: "画面にタッチして開始してください",
    maintenanceTitle: "メンテナンス中です",
    maintenanceBody: "しばらくしてから再度お試しください。",
    offlineTitle: "一時的にご利用いただけません",
    changeRequestButton: "お釣りを受け取れませんでしたか？口座で受け取る",
    boardFind: "バーコードのない商品を探す",
    boardClose: "閉じる",
    boardInstruction: "バーコードのない商品は下のバーコードをスキャンしてください",
    changeRequestTitle: "お釣りを口座で受け取る",
    changeRequestSubtitle: "お受け取りいただけなかったお釣りをご入力の口座にお振込みします。",
    reasonTitle: "どのような状況ですか？",
    reasonShortage: "釣り銭が不足していた",
    reasonShortageDesc: "機械の釣り銭が足りず、全部または一部を受け取れなかった場合",
    reasonError: "機械の故障で受け取れなかった",
    reasonErrorDesc: "釣り銭はあったが、排出エラーなどでお釣りが出なかった場合",
    transferOnlyNote: "未受領のお釣りは口座振込でのみお返しします。",
    amountLabel: "未受領金額（ウォン）",
    amountPlaceholder: "例：1500",
    bankNameLabel: "銀行",
    bankSelectPlaceholder: "銀行を選択してください",
    accountNumberLabel: "口座番号",
    accountNumberPlaceholder: "数字のみ（'-'なし）",
    accountConfirmLabel: "口座番号の確認（もう一度入力）",
    accountMismatch: "口座番号が一致しません。もう一度ご確認ください。",
    noNameNote: "お名前・連絡先はお預かりしません。銀行と口座番号のみご入力ください。",
    consentTitle: "個人情報の収集・利用への同意（必須）",
    consentPurposeLabel: "収集・利用目的",
    consentPurpose: "未受領のお釣りの口座振込",
    consentItemsLabel: "収集項目",
    consentItems: "銀行名、口座番号",
    consentRetentionLabel: "保有・利用期間",
    consentRetention: "振込完了または申請取消後、直ちに破棄（精算確認のため口座番号の下4桁のみ保管）",
    consentRefusalLabel: "同意を拒否する権利",
    consentRefusal: "同意を拒否できますが、その場合は口座振込でお受け取りいただけません。店内に掲示の連絡先までお問い合わせください。",
    consentAgree: "上記の内容を確認し、個人情報の収集・利用に同意します。",
    back: "戻る",
    submit: "口座振込を申請",
    submitting: "登録中...",
    doneTitle: "申請されました",
    doneBody: "店舗で確認後、ご入力の口座にお振込みします。振込完了後、口座番号は直ちに破棄されます。",
  },
};
