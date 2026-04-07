import type { NextConfig } from "next";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  assetPrefix: configuredBasePath || undefined,
  basePath: configuredBasePath || undefined,
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
