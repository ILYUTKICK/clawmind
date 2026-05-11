export default function Page() {
  return (
    <main style={{ background: "#0a0a0b", color: "#fafafa", minHeight: "100vh", padding: 32 }}>
      <h1 style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 28, margin: 0 }}>
        ClawMind MCP Server
      </h1>
      <p style={{ color: "#8b8b94", maxWidth: 720, lineHeight: 1.6 }}>
        Remote MCP wrapper for ClawMind Web3 due diligence. Connect to{" "}
        <code>/api/mcp</code> with the <code>X-MCP-Client-Id</code> header.
      </p>
    </main>
  );
}
