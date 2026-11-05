// 안내멘트를 기기 음성(브라우저 TTS)으로 읽을 때 쓰는 공용 함수.
// 기본 한국어 음성은 기계음처럼 들리는 경우가 많아서, 기기에 깔린 한국어 음성 중
// 더 자연스러운 것(Edge/Windows의 "Natural"·"Online" 음성, 크롬의 Google 음성,
// 아이폰의 유나 등)을 먼저 고른다. 가장 자연스러운 소리를 원하면 녹음 파일이나
// 음성 합성 서비스로 만든 파일을 안내멘트에 올리는 게 확실하다(audio_url).
const PREFERRED_VOICE_NAMES = [/natural/i, /online/i, /neural/i, /google/i, /yuna|유나/i, /sunhi|injoon|heami/i];

export function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
  for (const pattern of PREFERRED_VOICE_NAMES) {
    const voice = voices.find((v) => pattern.test(v.name));
    if (voice) return voice;
  }
  return voices[0] ?? null;
}

export function makeKoreanUtterance(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ko-KR";
  const voice = pickKoreanVoice();
  if (voice) utter.voice = voice;
  // 처지지 않고 발랄하게 들리도록 조금 빠르고 톤을 높여서 읽는다.
  utter.rate = 1.08;
  utter.pitch = 1.2;
  return utter;
}

// 음성 목록은 페이지가 뜬 직후엔 비어 있다가 나중에 채워지는 브라우저가 많아서,
// 미리 한 번 불러 두면 첫 멘트부터 고른 음성으로 읽는다.
export function warmUpVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}
