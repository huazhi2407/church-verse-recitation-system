import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 若在 monorepo 根目錄執行 build，指定此子專案為根目錄，避免 deploy 偵測錯誤
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
