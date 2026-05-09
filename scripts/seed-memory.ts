/**
 * ClawMind Memory Seeding Script
 *
 * Runs 50 diverse Web3 analysis tasks through the ClawMind API
 * to populate memory with real (not mock) data.
 *
 * Usage: npx tsx scripts/seed-memory.ts
 *        npm run seed
 */

const API_URL = "http://localhost:3000/api/analyze";
const DELAY_MS = 4000; // 4 seconds between requests

// 50 diverse Web3 analysis tasks spanning 20+ sub-domains
const TASKS: string[] = [
  // ── 1. DeFi Yield Aggregators ──────────────────────────────────
  "Analyze the risk profile of a DeFi yield aggregator using automated strategy rebalancing on Ethereum, focusing on smart contract composability and impermanent loss exposure",

  // ── 2. DAO Governance ──────────────────────────────────────────
  "Evaluate the governance structure of a DAO that uses quadratic voting and delegated authority for treasury allocation decisions, assessing centralization and sybil resistance",

  // ── 3. NFT Marketplace Risks ───────────────────────────────────
  "Assess the smart contract and operational risks of a permissionless NFT marketplace that supports lazy minting, bundle sales, and creator royalties enforcement",

  // ── 4. Oracle Manipulation ─────────────────────────────────────
  "Analyze the attack surface of a lending protocol that relies on a single Uniswap V3 TWAP oracle for price feeds, including flash-loan-enabled manipulation vectors",

  // ── 5. MEV Bot Strategies ──────────────────────────────────────
  "Review the risk landscape of MEV extraction strategies including sandwich attacks, just-in-time liquidity, and cross-domain arbitrage on Ethereum and L2s",

  // ── 6. Cross-Chain Bridge Security ─────────────────────────────
  "Analyze security risks of a multi-signature cross-chain bridge that uses optimistic verification with a 7-day challenge period for asset transfers between Ethereum and L2s",

  // ── 7. Restaking / Liquid Staking ──────────────────────────────
  "Assess the systemic risk of a liquid restaking protocol that allows restakers to allocate staked ETH to multiple AVS services simultaneously, including slashing propagation risk",

  // ── 8. Account Abstraction Wallets ─────────────────────────────
  "Evaluate the security model of an ERC-4337 account abstraction wallet with social recovery, session keys, and multi-chain deployment, focusing on bundler and paymaster risks",

  // ── 9. RWA Tokenization ────────────────────────────────────────
  "Analyze the legal and smart contract risks of a platform tokenizing US Treasury bills as ERC-20 tokens, including regulatory compliance, KYC gating, and redemption mechanisms",

  // ── 10. AI Agent Autonomy ──────────────────────────────────────
  "Assess the risk profile of an autonomous on-chain AI agent that can execute trades and manage DeFi positions based on LLM-generated strategies without human approval",

  // ── 11. Stablecoin Depeg Risks ─────────────────────────────────
  "Analyze the depeg risk of an algorithmic stablecoin backed by a volatile collateral pool with a dynamic mint-burn redemption mechanism and no direct fiat backing",

  // ── 12. Flash Loan Attack Vectors ──────────────────────────────
  "Identify flash loan attack vectors against a DEX aggregator that routes trades across multiple AMMs and lending protocols in a single transaction with atomic settlement",

  // ── 13. Governance Attacks ─────────────────────────────────────
  "Evaluate the risk of governance attacks on a DeFi protocol where governance tokens can be flash-borrowed, including proposal spam and hostile takeover scenarios",

  // ── 14. Tokenomics Analysis ────────────────────────────────────
  "Assess the tokenomics of a DeFi protocol with a 4-year vesting schedule, inflationary rewards, and a buy-and-burn mechanism, analyzing supply pressure and value accrual",

  // ── 15. Validator Concentration ────────────────────────────────
  "Analyze the risk of validator concentration in a PoS network where the top 10 validators control over 35% of staked assets, including censorship and liveness concerns",

  // ── 16. Smart Contract Audit Findings ──────────────────────────
  "Review a critical reentrancy vulnerability found in a yield vault's withdrawal function that uses state-modifying callbacks before balance updates, and assess exploit feasibility",

  // ── 17. Mempool Privacy ────────────────────────────────────────
  "Assess the privacy implications of pending transaction visibility in the public mempool, including front-running exposure and the effectiveness of private transaction pools like Flashbots Protect",

  // ── 18. ZK Proof Verification ──────────────────────────────────
  "Evaluate the security of a zk-rollup that uses recursive SNARK proofs for state transitions, focusing on verifier contract correctness, trusted setup assumptions, and proof generation integrity",

  // ── 19. DeFi Composability Risks ───────────────────────────────
  "Analyze the systemic risk from composability in a DeFi stack where a yield token is used as collateral in lending, restaked in vaults, and wrapped as an LP position simultaneously",

  // ── 20. Layer 2 Scaling Solutions ──────────────────────────────
  "Assess the security and liveness of an optimistic rollup with a centralized sequencer and a 1-week withdrawal delay, including sequencer censorship and forced inclusion mechanisms",

  // ── 21. DeFi Insurance Protocols ───────────────────────────────
  "Evaluate the risk model of a decentralized insurance protocol that covers smart contract exploits using a bonding curve for pricing and a claims assessment DAO with staked assessors",

  // ── 22. Token Bridge Exploits ──────────────────────────────────
  "Analyze the vulnerability surface of a canonical token bridge that uses a relayer network for cross-chain message passing, including message replay and relayer collusion scenarios",

  // ── 23. Decentralized Identity ─────────────────────────────────
  "Assess the privacy and security trade-offs of a decentralized identity system using verifiable credentials stored on-chain with selective disclosure via ZK proofs",

  // ── 24. Privacy Protocols ──────────────────────────────────────
  "Evaluate the security of a privacy protocol that uses Tornado Cash-style fixed-denomination pools with a newer nullifier scheme, analyzing linkability and compliance risks",

  // ── 25. On-Chain Forensics ─────────────────────────────────────
  "Assess the effectiveness of on-chain forensics techniques for tracing illicit funds through mixer protocols, cross-chain hops, and DEX swaps, including false positive rates",

  // ── 26. Liquid Staking Derivatives ─────────────────────────────
  "Analyze the risk of a liquid staking derivative whose token drifts from the ETH peg due to validator exit queue delays and penalty propagation during network turbulence",

  // ── 27. Permissioned DeFi ──────────────────────────────────────
  "Evaluate the security and compliance risks of a permissioned DeFi lending protocol that gates access through on-chain KYC attestations and restricts collateral to whitelisted tokens",

  // ── 28. NFT Lending Protocols ──────────────────────────────────
  "Assess the risk profile of an NFT lending platform that uses peer-to-pool lending with oracle-based LTV ratios and automated liquidation for blue-chip NFT collateral",

  // ── 29. Prediction Markets ─────────────────────────────────────
  "Analyze the oracle and manipulation risks of a decentralized prediction market that resolves outcomes using UMA's optimistic oracle with a dispute resolution mechanism",

  // ── 30. Decentralized Storage ──────────────────────────────────
  "Evaluate the economic security of a decentralized storage network where storage providers must stake collateral and prove data retention through periodic cryptographic challenges",

  // ── 31. Token Vesting and Lockups ──────────────────────────────
  "Assess the market impact of a large token unlock event where 20% of circulating supply vests to insiders simultaneously, analyzing sell pressure and DEX liquidity depth",

  // ── 32. Perpetual DEX Security ─────────────────────────────────
  "Analyze the risk of a decentralized perpetual futures exchange using a vAMM pricing model with dynamic funding rates, including insurance fund depletion and oracle delay scenarios",

  // ── 33. Cross-Chain Messaging ──────────────────────────────────
  "Evaluate the security of a cross-chain messaging protocol using a light client verification model for passing arbitrary data between EVM chains, including consensus finality assumptions",

  // ── 34. AMM Concentrated Liquidity ─────────────────────────────
  "Assess the risk of providing concentrated liquidity in a Uniswap V3-style AMM with narrow tick ranges, including impermanent loss, fee accrual variance, and rebalancing costs",

  // ── 35. Decentralized Autonomous Corporation ───────────────────
  "Analyze the legal and operational risk of a DAC that issues revenue-sharing tokens and operates automated DeFi strategies with no human board oversight",

  // ── 36. Stablecoin Regulatory Risk ─────────────────────────────
  "Assess the regulatory risk exposure of a fiat-backed stablecoin issuer operating across multiple jurisdictions, including reserve transparency, redemption guarantees, and sanctions compliance",

  // ── 37. Yield Farming Sustainability ───────────────────────────
  "Evaluate the sustainability of a yield farming protocol offering triple-digit APYs funded by inflationary token emissions, analyzing the emission schedule and TVL retention dynamics",

  // ── 38. Decentralized Governance Tooling ───────────────────────
  "Assess the risk of a Snapshot-based governance system that uses off-chain voting with on-chain execution via a Gnosis Safe multisig, including execution trust assumptions",

  // ── 39. Rebase Token Mechanics ─────────────────────────────────
  "Analyze the risk profile of a rebase token that adjusts supply dynamically based on a demand oracle, including depeg risk, negative rebases, and integration issues with DeFi protocols",

  // ── 40. Intent-Based Order Flow ────────────────────────────────
  "Evaluate the security of an intent-based order flow architecture where solvers compete to fill user intents across chains, including solver collusion and front-running risks",

  // ── 41. Real-Time Oracle Feeds ─────────────────────────────────
  "Assess the reliability and manipulation resistance of a high-frequency oracle feed aggregating data from 21 independent nodes with a median-based consensus and stake-based slashing",

  // ── 42. Modular Blockchain Architecture ────────────────────────
  "Analyze the security implications of a modular blockchain stack that separates execution, consensus, and data availability layers, including data availability sampling and proof verification",

  // ── 43. Decentralized Exchange Aggregation ─────────────────────
  "Assess the risk of a DEX aggregator that splits orders across multiple venues and uses gas-optimized routing, including MEV exposure during split execution and slippage at scale",

  // ── 44. Token-Gated Communities ────────────────────────────────
  "Evaluate the security and centralization risks of a token-gated community platform where membership is controlled by ERC-721 ownership, including wallet compromise recovery and transfer restrictions",

  // ── 45. Automated Portfolio Rebalancing ────────────────────────
  "Assess the risk of an automated portfolio rebalancing protocol that shifts allocations between DeFi yield strategies based on on-chain signal triggers, including signal manipulation and gas cost drag",

  // ── 46. Zero-Knowledge Identity Verification ───────────────────
  "Analyze the trade-offs of a ZK-based identity verification system that proves KYC compliance without revealing personal data, including proof generation costs and revocation mechanisms",

  // ── 47. Collateralized Debt Position Safety ────────────────────
  "Evaluate the liquidation risk in a CDP-based stablecoin system during extreme market volatility, including cascade liquidation risk, keeper incentives, and bad debt accumulation",

  // ── 48. On-Chain Random Number Generation ──────────────────────
  "Assess the security of an on-chain random number generation system using a commit-reveal scheme with economic incentives, including bias resistance and collusion among revealers",

  // ── 49. Multi-Sig Wallet Security ──────────────────────────────
  "Analyze the operational security of a Gnosis Safe multi-sig wallet used for protocol treasury management, including key holder compromise, social engineering, and delayed execution risks",

  // ── 50. DeFi Protocol Upgrade Risks ────────────────────────────
  "Evaluate the risk of a governance-executed protocol upgrade that modifies core lending risk parameters including liquidation thresholds, interest rate models, and collateral factors simultaneously",
];

// ── Types ────────────────────────────────────────────────────────

interface AnalysisReport {
  summary: string;
  score: number;
  recommendation: "GO" | "NO_GO" | "INVESTIGATE_MORE";
  risks: Array<{ title: string; severity: string; explanation: string }>;
  opportunities: string[];
  architecture: string[];
  nextSteps: string[];
  evidence: string[];
}

interface StorageReceipt {
  reportHash: string;
  storageUri?: string;
  provider: string;
  createdAt: string;
}

interface OnChainReceipt {
  analysisId: number;
  txHash: string;
  blockNumber: number;
  contractAddress: string;
  explorerTxUrl: string;
  provider: string;
}

interface AnalysisResult {
  task: string;
  steps: unknown[];
  relevantMemories: unknown[];
  report: AnalysisReport;
  receipt: StorageReceipt;
  memoryIndexReceipt?: StorageReceipt;
  onChainReceipt?: OnChainReceipt;
}

// ── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedTask(index: number, task: string): Promise<AnalysisResult | null> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`  ✗ [${index + 1}/50] HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
      return null;
    }

    const result = (await response.json()) as AnalysisResult;

    // Log key results
    const analysisId = result.onChainReceipt?.analysisId ?? "N/A";
    const rootHash = result.receipt.reportHash;
    const txHash = result.onChainReceipt?.txHash ?? "N/A";
    const score = result.report.score;
    const recommendation = result.report.recommendation;

    console.log(
      `  ✓ [${index + 1}/50] score=${score} rec=${recommendation} hash=${rootHash.slice(0, 16)}… tx=${txHash === "N/A" ? "N/A" : txHash.slice(0, 16) + "…"} id=${analysisId}`
    );

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ [${index + 1}/50] Error: ${message}`);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       ClawMind Memory Seeding Script        ║");
  console.log("║          50 Web3 Analysis Tasks              ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  console.log(`API endpoint: ${API_URL}`);
  console.log(`Delay between requests: ${DELAY_MS}ms`);
  console.log(`Total tasks: ${TASKS.length}`);
  console.log();

  // Verify API is reachable before starting
  try {
    const healthCheck = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "health check ping test for connectivity" }),
    });
    if (!healthCheck.ok) {
      console.error("✗ API health check failed. Is the dev server running?");
      console.error("  Start with: npm run dev");
      process.exit(1);
    }
    await healthCheck.json();
    console.log("✓ API is reachable\n");
  } catch {
    console.error("✗ Cannot reach API at", API_URL);
    console.error("  Make sure the ClawMind dev server is running: npm run dev");
    process.exit(1);
  }

  const results: AnalysisResult[] = [];
  const failures: { index: number; task: string }[] = [];
  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    console.log(`▶ Task ${i + 1}/${TASKS.length}: ${task.slice(0, 80)}…`);

    const result = await seedTask(i, task);

    if (result) {
      results.push(result);
    } else {
      failures.push({ index: i, task });
    }

    // Delay between requests (skip after the last one)
    if (i < TASKS.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Summary ──────────────────────────────────────────────────

  console.log();
  console.log("════════════════════════════════════════════════");
  console.log("               SEED SUMMARY                    ");
  console.log("════════════════════════════════════════════════");
  console.log(`  Total tasks:      ${TASKS.length}`);
  console.log(`  Successful:       ${results.length}`);
  console.log(`  Failed:           ${failures.length}`);
  console.log(`  Elapsed:          ${elapsed}s`);

  if (results.length > 0) {
    const scores = results.map((r) => r.report.score);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    const recCounts = results.reduce(
      (acc, r) => {
        acc[r.report.recommendation] = (acc[r.report.recommendation] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(`  Average score:    ${avgScore}`);
    console.log(`  Score range:      ${minScore} – ${maxScore}`);
    console.log(`  Recommendations:  ${Object.entries(recCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`);

    // Unique risk severities seen
    const severities = results.flatMap((r) => r.report.risks.map((risk) => risk.severity));
    const sevCounts = severities.reduce(
      (acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(`  Risk severities:  ${Object.entries(sevCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`);

    // Storage providers used
    const providers = results.map((r) => r.receipt.provider);
    const provCounts = providers.reduce(
      (acc, p) => {
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(`  Storage provider: ${Object.entries(provCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`);
  }

  if (failures.length > 0) {
    console.log();
    console.log("  Failed tasks:");
    for (const f of failures) {
      console.log(`    #${f.index + 1}: ${f.task.slice(0, 60)}…`);
    }
  }

  console.log("════════════════════════════════════════════════");
  console.log();
  console.log(`✓ Memory seeding complete. ${results.length} analysis records stored.`);
  console.log("  Run the ClawMind app to query seeded memories via the UI or API.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
