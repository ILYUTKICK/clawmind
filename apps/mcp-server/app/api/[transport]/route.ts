import { createClawMindMcpRoute } from "@/lib/mcp-route";

const handler = createClawMindMcpRoute("/api");

export { handler as GET, handler as POST, handler as DELETE };
