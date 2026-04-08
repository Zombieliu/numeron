import type { NextConfig } from "next";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  assetPrefix: configuredBasePath || undefined,
  basePath: configuredBasePath || undefined,
  output: "export",
  reactStrictMode: true,
  transpilePackages: [
    "numeron-contracts",
    "@0xobelisk/react",
    "@0xobelisk/sui-client",
    "@mysten/dapp-kit",
    "@tanstack/react-query",
  ],
  trailingSlash: true,
};

export default nextConfig;
