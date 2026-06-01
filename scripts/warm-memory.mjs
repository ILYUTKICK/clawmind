// ---------------------------------------------------------------------------
// ClawMind - Semantic memory warm-up
// ---------------------------------------------------------------------------
// Runs curated Web3 due-diligence tasks through /api/analyze and waits for
// /api/status completion before starting the next task.
//
// Defaults to localhost and a small batch. Use --prod explicitly when you want
// to spend real 0G Compute/Storage/Chain resources.
//
// Examples:
//   npm run warm-memory
//   npm run warm-memory -- --limit 10
//   npm run warm-memory -- --prod --limit 5
//   CLAWMIND_WARM_BASE_URL=https://your-app.vercel.app npm run warm-memory
// ---------------------------------------------------------------------------

const DEFAULT_LOCAL_BASE_URL = "http://localhost:3000";
const PROD_BASE_URL = "https://clawmind-puce.vercel.app";
const DEFAULT_LIMIT = 5;
const DEFAULT_DELAY_MS = 65_000;
const DEFAULT_POLL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 8 * 60_000;

const TASKS = [
  "Review a mature non-custodial Uniswap V3 analytics dashboard with no wallet connection, no transaction signing, public indexed data only, and read-only pool analytics for LP research.",
  "Audit a self-custodial AI trading agent that can rebalance user DeFi positions automatically, stores a hot private key in an environment variable, and has no withdrawal guardrails.",
  "Evaluate a new cross-chain bridge that uses a 5-of-9 validator multisig, supports arbitrary message passing, has a 48-hour challenge window, and plans $25M initial liquidity.",
  "Assess a novel AMM using a custom TWAP oracle, one boutique audit, $4M target TVL, anonymous founders, and governance-controlled fee parameters.",
  "Review a DAO treasury automation tool where Gnosis Safe signers approve all transactions, upgrades are timelocked for 48 hours, and AI only prepares proposals without signing.",
  "Evaluate an ERC-4337 wallet assistant that suggests transactions, uses session keys for limited actions, shows simulations, and requires explicit user confirmation for transfers.",
  "Analyze a liquid staking protocol with audited core contracts, centralized validator operations, slashing insurance claims, and delayed withdrawal queues during validator exits.",
  "Review an NFT marketplace escrow contract that temporarily holds ERC-721 assets, supports seller disputes, exposes emergency pause controls, and charges dynamic marketplace fees.",
  "Assess a DeFi lending protocol relying on a single low-liquidity DEX oracle, allowing high leverage, instant collateral onboarding, and governance-controlled liquidation thresholds.",
  "Evaluate a public data indexer API used by downstream trading bots, with no custody but strict freshness requirements, outage fallback behavior, and weak source provenance.",
  "Review a privacy-preserving KYC attestation system using zero-knowledge proofs, selective disclosure, revocation lists, and on-chain credential verification for permissioned DeFi.",
  "Audit a perpetual DEX with an insurance fund, delayed oracle updates, dynamic funding rates, and a centralized sequencer dependency for order matching.",
  "Assess a real-world asset tokenization protocol for treasury bills with KYC-gated ERC-20 transfers, off-chain redemption workflows, and reserve attestations from a third party.",
  "Evaluate a token launch with 20 percent insider unlock in one epoch, thin DEX liquidity, inflationary rewards, and a buyback promise funded by future protocol revenue.",
  "Review a governance upgrade that changes lending collateral factors, liquidation thresholds, oracle sources, and interest rate curves in one bundled proposal.",
];

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.CLAWMIND_WARM_BASE_URL || DEFAULT_LOCAL_BASE_URL,
    delayMs: DEFAULT_DELAY_MS,
    limit: DEFAULT_LIMIT,
    pollMs: DEFAULT_POLL_MS,
    start: 0,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--prod") {
      options.baseUrl = PROD_BASE_URL;
    } else if (arg === "--base-url" && next) {
      options.baseUrl = next;
      i += 1;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--poll-ms" && next) {
      options.pollMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--start" && next) {
      options.start = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--timeout-ms" && next) {
      options.timeoutMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    fail("--limit must be a positive integer.");
  }

  if (!Number.isInteger(options.start) || options.start < 0) {
    fail("--start must be a non-negative integer.");
  }

  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    fail("--delay-ms must be a non-negative integer.");
  }

  if (!Number.isInteger(options.pollMs) || options.pollMs < 1000) {
    fail("--poll-ms must be at least 1000.");
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < options.pollMs) {
    fail("--timeout-ms must be greater than --poll-ms.");
  }

  return options;
}

function printHelp() {
  console.log("Usage: npm run warm-memory -- [options]");
  console.log("");
  console.log("Options:");
  console.log("  --prod                 Use https://clawmind-puce.vercel.app");
  console.log("  --base-url <url>       Override the ClawMind app base URL");
  console.log("  --limit <n>            Number of curated tasks to run (default: 5)");
  console.log("  --start <n>            Start offset in the task list (default: 0)");
  console.log("  --delay-ms <ms>        Delay after each completed task (default: 65000)");
  console.log("  --poll-ms <ms>         Status polling interval (default: 10000)");
  console.log("  --timeout-ms <ms>      Per-task timeout (default: 480000)");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function shortHash(value) {
  if (typeof value !== "string" || value.length < 16) {
    return value || "n/a";
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-clawmind-source": "web",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed;

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return parsed;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-store",
    },
  });

  const text = await response.text();
  let parsed;

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return parsed;
}

async function waitForTask(baseUrl, taskId, options) {
  const startedAt = Date.now();
  let lastStep = "";

  while (Date.now() - startedAt <= options.timeoutMs) {
    const status = await getJson(
      `${baseUrl}/api/status?taskId=${encodeURIComponent(taskId)}`,
    );

    const stepLabel = status.currentStep || status.status;

    if (stepLabel && stepLabel !== lastStep) {
      console.log(`    step: ${stepLabel}`);
      lastStep = stepLabel;
    }

    if (status.status === "completed") {
      return status.result;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "analysis failed");
    }

    await sleep(options.pollMs);
  }

  throw new Error(`timed out after ${formatDuration(options.timeoutMs)}`);
}

async function runTask(baseUrl, task, index, total, options) {
  console.log(`[${index + 1}/${total}] ${task}`);
  const startedAt = Date.now();
  const startResult = await postJson(`${baseUrl}/api/analyze`, {
    task,
    source: "web",
  });

  if (!startResult.taskId) {
    throw new Error("analyze endpoint did not return taskId");
  }

  console.log(`    taskId: ${startResult.taskId}`);

  const result = await waitForTask(baseUrl, startResult.taskId, options);
  const elapsed = Date.now() - startedAt;
  const receipt = result?.receipt;
  const onChainReceipt = result?.onChainReceipt;
  const report = result?.report;

  console.log(
    [
      `    done in ${formatDuration(elapsed)}`,
      `score=${report?.score ?? "n/a"}`,
      `rec=${report?.recommendation ?? "n/a"}`,
      `report=${shortHash(receipt?.reportHash)}`,
      `tx=${shortHash(onChainReceipt?.txHash)}`,
    ].join(" | "),
  );

  return {
    taskId: startResult.taskId,
    task,
    elapsed,
    score: report?.score,
    recommendation: report?.recommendation,
    reportHash: receipt?.reportHash,
    storageUri: receipt?.storageUri,
    txHash: onChainReceipt?.txHash,
    analysisId: onChainReceipt?.analysisId,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const selectedTasks = TASKS.slice(options.start, options.start + options.limit);

  if (selectedTasks.length === 0) {
    fail("No tasks selected. Check --start and --limit.");
  }

  console.log("ClawMind semantic memory warm-up");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tasks: ${selectedTasks.length} of ${TASKS.length}`);
  console.log(`Delay: ${formatDuration(options.delayMs)}`);
  console.log(`Timeout per task: ${formatDuration(options.timeoutMs)}`);
  console.log("");

  const results = [];
  const failures = [];
  const startedAt = Date.now();

  for (let i = 0; i < selectedTasks.length; i += 1) {
    const task = selectedTasks[i];
    const absoluteIndex = options.start + i;

    try {
      const result = await runTask(baseUrl, task, absoluteIndex, TASKS.length, options);
      results.push(result);
    } catch (error) {
      failures.push({ task, error: error instanceof Error ? error.message : String(error) });
      console.error(`    failed: ${failures.at(-1).error}`);
    }

    if (i < selectedTasks.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log("");
  console.log("Summary");
  console.log(`Completed: ${results.length}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Elapsed: ${formatDuration(elapsed)}`);

  if (results.length > 0) {
    const recCounts = results.reduce((acc, result) => {
      const key = result.recommendation || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `Recommendations: ${Object.entries(recCounts)
        .map(([key, count]) => `${key}=${count}`)
        .join(", ")}`,
    );
    console.log(`Latest tx: ${shortHash(results.at(-1)?.txHash)}`);
  }

  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failures) {
      console.log(`- ${failure.task.slice(0, 90)}... -> ${failure.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
