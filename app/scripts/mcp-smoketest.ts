#!/usr/bin/env tsx
/**
 * THROWAWAY SCRIPT — delete or .gitignore after Wednesday's verification run.
 *
 * Per BUILD_PLAN.md § Wednesday: confirms that
 *   1. `npx -y financial-hub-mcp` spawns cleanly from your machine
 *   2. a basic tools/list round-trip works over stdio
 *   3. calling `get_stock_quote` with `symbol: "AAPL"` returns real data
 *
 * Run with:   npm run smoketest
 * Or:         npx tsx scripts/mcp-smoketest.ts
 *
 * If this script works, your MCP plumbing works. If it fails, fix the plumbing
 * before you write any Sunday product code.
 *
 * PREREQUISITES: run `npm install` first so @modelcontextprotocol/sdk is on disk.
 * The financial-hub-mcp package is fetched by npx on demand — no pre-install.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("[smoketest] spawning financial-hub-mcp via npx...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "financial-hub-mcp"],
    env: {
      ...process.env,
      SEC_USER_AGENT_EMAIL:
        process.env.SEC_USER_AGENT_EMAIL ?? "smoketest@example.com",
      FRED_API_KEY: process.env.FRED_API_KEY ?? "",
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ?? "",
    } as Record<string, string>,
  });

  const client = new Client(
    { name: "fidelio-smoketest", version: "0.0.1" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    console.log("[smoketest] connected. listing tools...");

    const tools = await client.listTools();
    console.log(
      `[smoketest] tools returned (${tools.tools.length}):`,
      tools.tools.map((t) => t.name).join(", "),
    );

    const quoteTool = tools.tools.find((t) => t.name === "get_stock_quote");
    if (!quoteTool) {
      console.error("[smoketest] get_stock_quote not found in tool list.");
      process.exit(1);
    }

    if (!process.env.FINNHUB_API_KEY) {
      console.warn(
        "[smoketest] FINNHUB_API_KEY not set — skipping live quote call. " +
          "Set it in .env.local and re-run to verify end-to-end.",
      );
    } else {
      console.log("[smoketest] calling get_stock_quote for AAPL...");
      const result = await client.callTool({
        name: "get_stock_quote",
        arguments: { symbol: "AAPL" },
      });
      console.log("[smoketest] result:", JSON.stringify(result, null, 2));
    }

    console.log("[smoketest] PASS — MCP plumbing works.");
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error("[smoketest] FAIL:", err);
    try {
      await client.close();
    } catch {
      /* swallow */
    }
    process.exit(1);
  }
}

main();
