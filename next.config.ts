import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit is the only serverExternalPackage we need on Vercel.
  // onnxruntime-node and @xenova/transformers are NOT used on Vercel
  // (embedding-provider.ts detects Vercel and skips them),
  // and listing them here caused the serverless function to exceed
  // the 50MB size limit.
  serverExternalPackages: ["pdfkit", "ioredis"],

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},
};

export default nextConfig;