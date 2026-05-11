// ---------------------------------------------------------------------------
// ClawMind — Deploy signed AnalysisRegistry with Foundry
// ---------------------------------------------------------------------------
// Usage from repo root:
//   node scripts/deploy-registry.mjs
//
// Requires:
//   - Foundry installed (`forge --version`)
//   - ZERO_G_STORAGE_PRIVATE_KEY=0x... wallet with 0G for gas
//   - ZERO_G_NETWORK=mainnet
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const privateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;
const network = process.env.ZERO_G_NETWORK;
const rpcUrl = process.env.ZERO_G_STORAGE_EVM_RPC ?? "https://evmrpc.0g.ai";
const explorerBase = "https://chainscan.0g.ai";
const contractsDir = path.join(process.cwd(), "contracts");

if (!privateKey || privateKey.includes("your_")) {
  fail("ERROR: ZERO_G_STORAGE_PRIVATE_KEY is not set to a real deployer key.");
}

if (network !== "mainnet") {
  console.warn("WARNING: ZERO_G_NETWORK is not 'mainnet'.");
}

const forgeVersion = spawnSync("forge", ["--version"], {
  encoding: "utf-8",
});

if (forgeVersion.status !== 0) {
  fail("ERROR: Foundry is not installed. Install it first, then run this script again.");
}

console.log("=== ClawMind signed AnalysisRegistry deployment ===");
console.log(`Network: ${network ?? "unknown"}`);
console.log(`RPC: ${rpcUrl}`);
console.log("Contract: contracts/AnalysisRegistry.sol:AnalysisRegistry");
console.log("");

const deploy = spawnSync(
  "forge",
  [
    "create",
    "AnalysisRegistry",
    "--rpc-url",
    rpcUrl,
    "--private-key",
    privateKey,
  ],
  {
    cwd: contractsDir,
    encoding: "utf-8",
    stdio: "pipe",
  }
);

if (deploy.stdout) {
  console.log(deploy.stdout);
}

if (deploy.stderr) {
  console.error(deploy.stderr);
}

if (deploy.status !== 0) {
  fail("Deployment failed.");
}

const match = deploy.stdout.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);

if (!match) {
  console.warn("Could not parse deployed address from forge output.");
  console.warn("Copy it from the output above and update ZERO_G_ANALYSIS_REGISTRY_ADDRESS.");
  process.exit(0);
}

const contractAddress = match[1];

console.log("");
console.log("UPDATE ENV:");
console.log(`ZERO_G_ANALYSIS_REGISTRY_ADDRESS=${contractAddress}`);
console.log("ZERO_G_ALLOW_LEGACY_REGISTRY_WRITES=false");
console.log("");
console.log(`Explorer: ${explorerBase}/address/${contractAddress}`);
console.log("");
console.log("The deployer is authorized as the first operator by the constructor.");
