import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "windtunnel-core",
    "@meteora-ag/dynamic-bonding-curve-sdk",
    "@meteora-ag/cp-amm-sdk",
    "@solana/web3.js",
    "bn.js",
  ],
};

export default nextConfig;
