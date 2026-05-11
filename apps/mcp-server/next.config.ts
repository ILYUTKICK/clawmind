import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ioredis"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
