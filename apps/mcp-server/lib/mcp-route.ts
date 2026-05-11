import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { analyzeWeb3Project, getRecentAnalyses } from "@/lib/clawmind-api";
import { checkRateLimit, getMcpClientId } from "@/lib/rate-limit";

type JsonRpcPayload = {
  method?: unknown;
  params?: {
    name?: unknown;
  };
};

function toolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

async function isToolCall(request: Request): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  try {
    const payload = (await request.clone().json()) as JsonRpcPayload;
    return payload.method === "tools/call";
  } catch {
    return false;
  }
}

export function createClawMindMcpRoute(basePath: string) {
  const mcpHandler = createMcpHandler(
    (server) => {
      server.tool(
        "analyze_web3_project",
        "Run ClawMind multi-agent due diligence for a Web3 project and return the signed on-chain report receipt.",
        {
          task: z
            .string()
            .min(10)
            .describe("A concrete Web3 project, protocol, or agent risk-analysis task."),
        },
        async ({ task }) => toolResult(await analyzeWeb3Project(task)),
      );

      server.tool(
        "get_recent_analyses",
        "Return recent ClawMind analyses from the public judge API.",
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .default(5)
            .describe("Maximum number of recent analyses to return."),
        },
        async ({ limit = 5 }) => toolResult(await getRecentAnalyses(limit)),
      );
    },
    {},
    {
      redisUrl: process.env.KV_REDIS_URL || process.env.REDIS_URL,
      basePath,
      maxDuration: 300,
    },
  );

  return async function handler(request: Request): Promise<Response> {
    const clientId = getMcpClientId(request);

    if (!clientId) {
      return jsonResponse(
        {
          error: "Missing required X-MCP-Client-Id header.",
          message: "Set X-MCP-Client-Id to any stable client identifier, for example demo-client.",
        },
        400,
      );
    }

    if (await isToolCall(request)) {
      const rateLimit = await checkRateLimit(clientId);

      if (!rateLimit.allowed) {
        return jsonResponse(
          {
            error: "Too Many Requests",
            message: `Rate limit exceeded for client ${clientId}. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
          },
          429,
          {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        );
      }
    }

    return mcpHandler(request);
  };
}
