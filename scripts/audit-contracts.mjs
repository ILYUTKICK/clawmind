#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const contractsDir = path.join(rootDir, "contracts");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawmind-slither-"));
const jsonPath = path.join(tmpDir, "analysis-registry-slither.json");

const acceptedFindings = [
  {
    check: "incorrect-equality",
    impact: "Medium",
    includes: ["AnalysisRegistry._enforceRateLimit"],
  },
  {
    check: "timestamp",
    impact: "Low",
    includes: ["AnalysisRegistry._enforceRateLimit"],
  },
  {
    check: "timestamp",
    impact: "Low",
    includes: ["AnalysisRegistry._validateSignatureTimestamp"],
  },
  {
    check: "assembly",
    impact: "Informational",
    includes: ["AnalysisRegistry._recoverSigner"],
  },
  {
    check: "solc-version",
    impact: "Informational",
    includes: ["Version constraint ^0.8.20"],
  },
];

function formatFinding(finding) {
  return `${finding.check} (${finding.impact}/${finding.confidence})`;
}

function isAcceptedFinding(finding) {
  const description = String(finding.description ?? "");

  return acceptedFindings.some((accepted) => {
    if (finding.check !== accepted.check || finding.impact !== accepted.impact) {
      return false;
    }

    return accepted.includes.every((needle) => description.includes(needle));
  });
}

const slitherArgs = [
  "--from",
  "slither-analyzer",
  "slither",
  ".",
  "--exclude-dependencies",
  "--filter-paths",
  "lib",
  "--json",
  jsonPath,
];

const result = spawnSync("uvx", slitherArgs, {
  cwd: contractsDir,
  stdio: "inherit",
});

if (result.error) {
  console.error(`[contract-audit] Failed to start Slither: ${result.error.message}`);
  console.error("[contract-audit] Install uv or run: pipx run slither-analyzer .");
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error("[contract-audit] Slither did not produce a JSON report.");
  process.exit(result.status ?? 1);
}

const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const findings = Array.isArray(report.results?.detectors)
  ? report.results.detectors
  : [];
const unexpectedFindings = findings.filter((finding) => !isAcceptedFinding(finding));

console.log(
  `[contract-audit] Slither findings: ${findings.length} total, ` +
    `${findings.length - unexpectedFindings.length} accepted, ` +
    `${unexpectedFindings.length} unexpected.`,
);
console.log(`[contract-audit] Raw JSON: ${jsonPath}`);

if (unexpectedFindings.length > 0) {
  console.error("[contract-audit] Unexpected Slither findings:");
  for (const finding of unexpectedFindings) {
    console.error(`- ${formatFinding(finding)}`);
  }
  process.exit(1);
}

if (report.success === false && findings.length === 0) {
  console.error("[contract-audit] Slither reported a failure without detector findings.");
  process.exit(result.status ?? 1);
}

console.log("[contract-audit] Only documented accepted findings were reported.");
