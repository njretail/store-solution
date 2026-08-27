import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 상품 이미지 업로드(휴대폰 사진)를 받기 위해 기본 1MB 제한을 늘림.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
