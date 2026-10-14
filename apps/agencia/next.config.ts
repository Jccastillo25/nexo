import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/agencia",
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],
  experimental: {
    serverActions: {
      allowedOrigins: ["nexo.materialesjcastillo.com"],
    },
  },
};

export default nextConfig;
