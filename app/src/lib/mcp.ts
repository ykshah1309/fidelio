/**
 * MCP client bridge — connects to financial-hub-mcp via stdio subprocess.
 *
 * This module manages the lifecycle of the MCP subprocess:
 *   - Lazy singleton: first call to `getFinancialHubBridge()` spawns the process.
 *   - Tool filtering: only WHITELISTED_TOOLS are exposed to Claude.
 *   - Graceful shutdown: `close()` kills the subprocess.
 *
 * IMPORTANT: On Vercel serverless, the subprocess dies with the function.
 * For long-lived hosts (Fly, Railway), the bridge stays alive across requests.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const WHITELISTED_TOOLS = [
  "get_stock_quote",
  "get_company_overview",
  "get_economic_data",
  "search_companies",
] as const;

export type WhitelistedTool = (typeof WHITELISTED_TOOLS)[number];

export interface MCPBridge {
  listTools(): Promise<
    Array<{
      name: string;
      description: string;
      input_schema: unknown;
    }>
  >;
  callTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

// ─── Singleton management ────────────────────────────────────────────────────

let _bridge: MCPBridge | null = null;
let _connecting: Promise<MCPBridge> | null = null;

export async function getFinancialHubBridge(): Promise<MCPBridge> {
  if (_bridge) return _bridge;
  if (_connecting) return _connecting;

  _connecting = createBridge();
  try {
    _bridge = await _connecting;
    return _bridge;
  } finally {
    _connecting = null;
  }
}

async function createBridge(): Promise<MCPBridge> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "financial-hub-mcp"],
    env: {
      ...process.env,
      SEC_USER_AGENT_EMAIL: process.env.SEC_USER_AGENT_EMAIL ?? "",
      FRED_API_KEY: process.env.FRED_API_KEY ?? "",
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ?? "",
    } as Record<string, string>,
  });

  const client = new Client(
    { name: "fidelio", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  // Cache the tool list on first connect — it doesn't change at runtime
  const rawTools = await client.listTools();
  const whitelistedSet = new Set<string>(WHITELISTED_TOOLS);
  const filteredTools = (rawTools.tools ?? [])
    .filter((t) => whitelistedSet.has(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema,
    }));

  const bridge: MCPBridge = {
    async listTools() {
      return filteredTools;
    },

    async callTool(name: string, input: Record<string, unknown>) {
      if (!whitelistedSet.has(name)) {
        throw new Error(
          `[Fidelio MCP] Tool "${name}" is not whitelisted. Allowed: ${WHITELISTED_TOOLS.join(", ")}`,
        );
      }
      const result = await client.callTool({ name, arguments: input });
      // MCP returns content as an array of { type, text } blocks
      const textParts = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string);
      const joined = textParts.join("");
      try {
        return JSON.parse(joined);
      } catch {
        return joined;
      }
    },

    async close() {
      try {
        await client.close();
      } catch {
        // swallow — process may already be dead
      }
      _bridge = null;
    },
  };

  return bridge;
}
