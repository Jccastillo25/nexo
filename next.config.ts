import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;

// Force dynamic rendering
export const dynamic = 'force-dynamic'
