export function getComputeProviderLabel(): "0G_COMPUTE" | "LOCAL_FALLBACK" {
  const endpoint = process.env.ZERO_G_COMPUTE_ENDPOINT;
  const apiKey = process.env.ZERO_G_COMPUTE_API_KEY;

  const isConfigured =
    typeof endpoint === "string" &&
    endpoint.trim().length > 0 &&
    typeof apiKey === "string" &&
    apiKey.trim().length > 0 &&
    apiKey !== "your_0g_router_api_key_here";

  return isConfigured ? "0G_COMPUTE" : "LOCAL_FALLBACK";
}