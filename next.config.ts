import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for native modules that can't be bundled by Turbopack
  serverExternalPackages: ["onnxruntime-node", "@xenova/transformers", "pdfkit"],

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},
};

export default nextConfig;
