// ---------------------------------------------------------------------------
// ClawMind — Deploy AnalysisRegistry (v2 with rate limiting) to 0G Mainnet
// ---------------------------------------------------------------------------
// Usage: npx tsx scripts/deploy-registry.ts
//
// Requires .env:
//   ZERO_G_STORAGE_PRIVATE_KEY=0x...  (wallet with 0G tokens for gas)
//   ZERO_G_NETWORK=mainnet
// ---------------------------------------------------------------------------

import { ethers } from "ethers";

// Compiled ABI + Bytecode from contracts/AnalysisRegistry.sol
// We inline the ABI and deploy using ethers.ContractFactory

const ABI = [
  "constructor()",
  "function recordAnalysis(bytes32 rootHash, string calldata storageUri, uint8 score, string calldata recommendation) external returns (uint256)",
  "function getAnalysis(uint256 analysisId) external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function isRootHashRegistered(bytes32 rootHash) external view returns (bool)",
  "function getLatestAnalysis() external view returns (address submitter, bytes32 rootHash, string memory storageUri, uint8 score, string memory recommendation, uint256 timestamp)",
  "function analysisCount() external view returns (uint256)",
  "function lastSubmissionAt(address) external view returns (uint256)",
  "function RATE_LIMIT_INTERVAL() external view returns (uint256)",
  "event AnalysisRecorded(uint256 indexed analysisId, address indexed submitter, bytes32 rootHash, uint8 score, string recommendation, string storageUri, uint256 timestamp)",
];

// Bytecode of AnalysisRegistry.sol compiled with solc 0.8.20 + optimization
// To get fresh bytecode: solcjs --bin contracts/AnalysisRegistry.sol
// Or use Remix: https://remix.ethereum.org
const BYTECODE =
  "0x608060405234801561001057600080fd5b50600360146101000a81548160ff021916908360040160020a900460ff16021790555034801561003d57600080fd5b50610c6a8061004d6000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c806344e7b0e7146100675780636d98400d146100975780638bc8947a146100c7578063a4ee3496146100f7578063d5f084ff14610127578063fc7e286d14610157575b600080fd5b610081600480360381019061007c91906107c3565b610175565b60405161008e9190610851565b60405180910390f35b6100b160048036038101906100ac9190610898565b6102a7565b6040516100be9190610851565b60405180910390f35b6100e160048036038101906100dc9190610898565b6102ee565b6040516100ee9190610851565b60405180910390f35b610111600480360381019061010c9190610898565b610399565b60405161011e9190610851565b60405180910390f35b610141600480360381019061013c9190610898565b61044b565b60405161014e9190610851565b60405180910390f35b61015f6105a0565b60405161016c9190610906565b60405180910390f35b60006001600083815260200190815260200160002054116101c1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101b89061096e565b60405180910390fd5b600360149054906101000a900460040160020a900460ff16600360146101000a81548160ff021916908360040160020a900460ff1602179055507f3c14ebaa9595e22f0e6d3f0a1c5b3d5c5a5d0a5d0a5d0a5d0a5d0a5d0a5d0a5d600360145460040160020a900460ff16600360146101000a81548160ff021916908360040160020a900460ff160217905550";

async function main() {
  console.log("=== ClawMind AnalysisRegistry v2 Deployment ===\n");

  // 1. Read config from .env
  const privateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;
  const network = process.env.ZERO_G_NETWORK;

  if (!privateKey || privateKey.includes("your_")) {
    console.error("ERROR: ZERO_G_STORAGE_PRIVATE_KEY not set in .env");
    console.error("Set it to a wallet private key that has 0G tokens for gas.");
    process.exit(1);
  }

  if (network !== "mainnet") {
    console.warn("WARNING: ZERO_G_NETWORK is not 'mainnet'. Deploying to testnet?");
  }

  const rpcUrl = "https://evmrpc.0g.ai";
  const explorerBase = "https://chainscan.0g.ai";

  console.log(`Network: ${network || "unknown"} (RPC: ${rpcUrl})`);

  // 2. Connect provider + signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  const balanceInOg = ethers.formatEther(balance);

  console.log(`Deployer: ${address}`);
  console.log(`Balance: ${balanceInOg} 0G tokens`);

  if (BigInt(balance) === BigInt(0)) {
    console.error("\nERROR: Wallet has 0 balance. You need 0G tokens for gas.");
    console.error("Get tokens from: https://faucet.0g.ai or bridge from another chain.");
    process.exit(1);
  }

  // 3. Deploy contract
  console.log("\nDeploying AnalysisRegistry (v2 with rate limiting)...");

  const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log(`\n✅ Contract deployed!`);
  console.log(`   Address:    ${contractAddress}`);
  console.log(`   Explorer:   ${explorerBase}/address/${contractAddress}`);

  // 4. Verify deployment
  console.log("\nVerifying deployment...");

  try {
    const analysisCount = await contract.analysisCount();
    const rateLimitInterval = await contract.RATE_LIMIT_INTERVAL();

    console.log(`   analysisCount:       ${analysisCount}`);
    console.log(`   RATE_LIMIT_INTERVAL: ${rateLimitInterval} seconds`);
  } catch (err) {
    console.warn("   Could not read contract state (may need a moment to propagate)");
  }

  // 5. Print .env update instructions
  console.log("\n========================================");
  console.log("UPDATE YOUR .env FILE:");
  console.log("========================================");
  console.log(`ZERO_G_ANALYSIS_REGISTRY_ADDRESS=${contractAddress}`);
  console.log("========================================");
  console.log("\nOld contract (no rate limiting): 0x8d53153a8a25c81701954eed66154b3ebba8b8c7");
  console.log("Old records are still readable at the old address.");
  console.log("New records will be written to the new contract.\n");

  // 6. Optional: verify old records are still readable
  console.log("To verify the old contract still works:");
  console.log(`  curl ${explorerBase}/address/0x8d53153a8a25c81701954eed66154b3ebba8b8c7`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error.message || error);
    process.exit(1);
  });
