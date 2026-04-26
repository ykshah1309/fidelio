import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tell Next.js the true monorepo root so it uses the right lockfile
  // and suppresses the "multiple lockfiles" warning on Vercel.
  outputFileTracingRoot: path.join(__dirname, "../"),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@modelcontextprotocol/sdk",
  ],
};

export default nextConfig;
