export function GET(): Response {
  return Response.json(
    {
      ok: true,
      service: "clawmind-mcp-server",
      tools: ["analyze_web3_project", "get_recent_analyses"],
      upstream: process.env.CLAWMIND_API_BASE_URL || "https://clawmind-puce.vercel.app",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
