// 키오스크 "고객의 소리" 화면(/kiosk/[id]/voice)의 다국어 문구. 메인 키오스크 사전
// (kiosk-i18n.ts)과 언어 목록은 같고, 이 화면에서만 쓰는 문구라 따로 둔다.
import type { KioskLang } from "./kiosk-i18n";
import type { CustomerVoiceKind } from "./types";

type VoiceStrings = {
  button: string;
  title: string;
  subtitle: string;
  kindTitle: string;
  kinds: Record<CustomerVoiceKind, { title: string; desc: string }>;
  tagTitle: Record<"product_request" | "complaint", string>;
  tags: Record<string, string>;
  messageLabel: string;
  messageOptional: string;
  messagePlaceholder: Record<CustomerVoiceKind, string>;
  anonymousNote: string;
  needInput: string;
  back: string;
  submit: string;
  submitting: string;
  doneTitle: string;
  doneBody: string;
  home: string;
};

export const KIOSK_VOICE_STRINGS: Record<KioskLang, VoiceStrings> = {
  ko: {
    button: "고객의 소리 · 원하는 상품 요청",
    title: "고객의 소리",
    subtitle: "원하는 상품이나 매장 이용 의견을 남겨 주세요.",
    kindTitle: "어떤 의견을 남기시겠어요?",
    kinds: {
      product_request: { title: "원하는 상품이 있어요", desc: "매장에 들어왔으면 하는 상품을 알려 주세요" },
      complaint: { title: "불편한 점이 있어요", desc: "품절, 청결, 기기 오류 등 불편했던 점" },
      compliment: { title: "칭찬하고 싶어요", desc: "좋았던 점을 알려 주세요" },
      other: { title: "기타 의견", desc: "그 밖에 하고 싶은 말씀" },
    },
    tagTitle: {
      product_request: "어떤 종류의 상품인가요? (여러 개 선택 가능)",
      complaint: "어떤 점이 불편하셨나요? (여러 개 선택 가능)",
    },
    tags: {
      drinks: "음료",
      snacks: "과자·간식",
      icecream: "아이스크림",
      instant: "라면·간편식",
      fresh: "신선식품",
      household: "생활용품",
      stationery: "문구·완구",
      soldout: "품절·재고 부족",
      clean: "청결",
      price: "가격",
      kiosk_error: "키오스크·결제 오류",
      temperature: "냉난방·냉장고",
    },
    messageLabel: "자세한 내용",
    messageOptional: "(선택)",
    messagePlaceholder: {
      product_request: "예: 제로콜라 1.5L, 컵라면 종류를 더 늘려 주세요",
      complaint: "예: 아이스크림 냉동고 문이 잘 안 닫혀요",
      compliment: "예: 늦은 밤에도 깨끗해서 좋아요",
      other: "하고 싶은 말씀을 자유롭게 적어 주세요",
    },
    anonymousNote: "이름·연락처는 받지 않습니다. 남겨 주신 의견은 매장 운영에 참고합니다.",
    needInput: "분류를 하나 이상 고르거나 내용을 입력해 주세요.",
    back: "이전",
    submit: "의견 보내기",
    submitting: "보내는 중...",
    doneTitle: "소중한 의견 감사합니다",
    doneBody: "남겨 주신 내용은 매장 관리자가 확인한 뒤 운영에 반영하겠습니다.",
    home: "처음 화면으로",
  },
  en: {
    button: "Feedback · Request a product",
    title: "Customer Feedback",
    subtitle: "Tell us which products you'd like or how we can improve.",
    kindTitle: "What would you like to share?",
    kinds: {
      product_request: { title: "I'd like a product", desc: "Tell us what you'd like us to carry" },
      complaint: { title: "Something was inconvenient", desc: "Sold out, cleanliness, machine errors, etc." },
      compliment: { title: "I want to give a compliment", desc: "Tell us what you liked" },
      other: { title: "Other feedback", desc: "Anything else you'd like to say" },
    },
    tagTitle: {
      product_request: "What kind of product? (choose any)",
      complaint: "What was inconvenient? (choose any)",
    },
    tags: {
      drinks: "Drinks",
      snacks: "Snacks",
      icecream: "Ice cream",
      instant: "Instant food",
      fresh: "Fresh food",
      household: "Household items",
      stationery: "Stationery · Toys",
      soldout: "Sold out",
      clean: "Cleanliness",
      price: "Price",
      kiosk_error: "Kiosk · Payment error",
      temperature: "Temperature · Fridge",
    },
    messageLabel: "Details",
    messageOptional: "(optional)",
    messagePlaceholder: {
      product_request: "e.g. Coke Zero 1.5L, more cup noodle options",
      complaint: "e.g. The ice cream freezer door doesn't close well",
      compliment: "e.g. It's clean even late at night",
      other: "Feel free to write anything",
    },
    anonymousNote: "We don't collect your name or contact details. Your feedback helps us run the store.",
    needInput: "Please choose at least one option or write a message.",
    back: "Back",
    submit: "Send feedback",
    submitting: "Sending...",
    doneTitle: "Thank you for your feedback",
    doneBody: "The store manager will review it and use it to improve the store.",
    home: "Back to start",
  },
  zh: {
    button: "顾客意见 · 想要的商品",
    title: "顾客意见",
    subtitle: "请留下您想要的商品或对本店的意见。",
    kindTitle: "您想留下什么意见？",
    kinds: {
      product_request: { title: "我想要某种商品", desc: "告诉我们您希望店里进的商品" },
      complaint: { title: "有不方便的地方", desc: "缺货、卫生、机器故障等" },
      compliment: { title: "我想表扬", desc: "告诉我们您满意的地方" },
      other: { title: "其他意见", desc: "其他想说的话" },
    },
    tagTitle: {
      product_request: "是哪类商品？（可多选）",
      complaint: "哪里不方便？（可多选）",
    },
    tags: {
      drinks: "饮料",
      snacks: "零食",
      icecream: "冰淇淋",
      instant: "方便面·速食",
      fresh: "生鲜食品",
      household: "生活用品",
      stationery: "文具·玩具",
      soldout: "缺货",
      clean: "卫生",
      price: "价格",
      kiosk_error: "自助机·支付故障",
      temperature: "空调·冰箱",
    },
    messageLabel: "详细内容",
    messageOptional: "（选填）",
    messagePlaceholder: {
      product_request: "例：零度可乐1.5L，多一些杯面种类",
      complaint: "例：冰淇淋冰柜的门关不严",
      compliment: "例：深夜也很干净",
      other: "请自由填写",
    },
    anonymousNote: "我们不收集姓名和联系方式。您的意见将用于改善门店运营。",
    needInput: "请至少选择一个分类或填写内容。",
    back: "返回",
    submit: "提交意见",
    submitting: "提交中...",
    doneTitle: "感谢您的宝贵意见",
    doneBody: "店铺管理员确认后会用于改善门店运营。",
    home: "返回首页",
  },
  ja: {
    button: "お客様の声 · ほしい商品のリクエスト",
    title: "お客様の声",
    subtitle: "ほしい商品や店舗へのご意見をお聞かせください。",
    kindTitle: "どのようなご意見ですか？",
    kinds: {
      product_request: { title: "ほしい商品があります", desc: "店舗に置いてほしい商品を教えてください" },
      complaint: { title: "不便な点がありました", desc: "品切れ、清潔さ、機器の不具合など" },
      compliment: { title: "良かった点を伝えたい", desc: "良かったところを教えてください" },
      other: { title: "その他のご意見", desc: "そのほかお伝えしたいこと" },
    },
    tagTitle: {
      product_request: "どの種類の商品ですか？（複数選択可）",
      complaint: "どの点が不便でしたか？（複数選択可）",
    },
    tags: {
      drinks: "飲み物",
      snacks: "お菓子",
      icecream: "アイスクリーム",
      instant: "ラーメン・インスタント食品",
      fresh: "生鮮食品",
      household: "日用品",
      stationery: "文具・おもちゃ",
      soldout: "品切れ",
      clean: "清潔さ",
      price: "価格",
      kiosk_error: "キオスク・決済の不具合",
      temperature: "冷暖房・冷蔵庫",
    },
    messageLabel: "詳しい内容",
    messageOptional: "（任意）",
    messagePlaceholder: {
      product_request: "例：コカ・コーラ ゼロ1.5L、カップ麺の種類を増やしてほしい",
      complaint: "例：アイスの冷凍庫の扉がきちんと閉まらない",
      compliment: "例：夜遅くでもきれいで良い",
      other: "ご自由にお書きください",
    },
    anonymousNote: "お名前・連絡先はお預かりしません。いただいたご意見は店舗運営の参考にいたします。",
    needInput: "分類を1つ以上選ぶか、内容をご入力ください。",
    back: "戻る",
    submit: "意見を送る",
    submitting: "送信中...",
    doneTitle: "貴重なご意見ありがとうございます",
    doneBody: "店舗の管理者が確認し、運営に反映いたします。",
    home: "最初の画面へ",
  },
};
