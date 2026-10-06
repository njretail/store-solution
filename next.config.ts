import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 상품 이미지(휴대폰 사진)뿐 아니라 키오스크 광고 영상 업로드까지 받기 위해
      // 기본 1MB 제한을 늘림 — 영상은 길게 찍지 말고 짧게 압축해서 올리는 걸 권장.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
