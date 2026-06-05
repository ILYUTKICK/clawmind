import { FeatureCard } from "@/components/landing/FeatureCard";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { LiveTicker } from "@/components/landing/LiveTicker";
import { McpIntegrationBlock } from "@/components/landing/McpIntegrationBlock";
import type { LandingLatestAnalysis } from "@/components/landing/types";
import type { Recommendation } from "@/lib/types";
import packageJson from "@/package.json";

export const revalidate = 30;
export const dynamic = "force-dynamic";

type JudgeRecentAnalysis = {
  analysisId: number;
  rootHash: string;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  explorerUrl: string;
};

type JudgeData = {
  analysisCount: number;
  recentAnalyses: JudgeRecentAnalysis[];
  latestOnChainAnalysis: {
    analysisId: number;
    rootHash: string;
    score: number;
    recommendation: Recommendation;
    timestamp: number;
    submitter: string;
    explorerTxUrl: string;
    signatureVerified?: boolean;
  } | null;
  memory: {
    totalRecords: number;
    runtimeGeneratedCount: number;
    seedCount: number;
  };
  integration: {
    onChain: {
      contractAddress: string | null;
      explorerUrl: string | null;
      operatorAuthentication: {
        signatureVerified: boolean;
      };
    };
  };
};

function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.CLAWMIND_APP_BASE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://clawmind-puce.vercel.app";
}

async function getJudgeData(): Promise<JudgeData | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/judge`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<JudgeData>;
  } catch {
    return null;
  }
}

function shortBuildHash(): string {
  const hash =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    "local";

  return hash === "local" ? hash : hash.slice(0, 7);
}

function getLatestAnalysis(data: JudgeData | null): LandingLatestAnalysis | null {
  if (!data) {
    return null;
  }

  const latest = data.latestOnChainAnalysis;
  const recent = data.recentAnalyses[0];

  if (!latest && !recent) {
    return null;
  }

  const analysisId = latest?.analysisId ?? recent.analysisId;

  return {
    analysisId,
    score: latest?.score ?? recent.score,
    recommendation: latest?.recommendation ?? recent.recommendation,
    timestamp: latest?.timestamp ?? recent.timestamp,
    rootHash: latest?.rootHash ?? recent.rootHash,
    explorerUrl:
      latest?.explorerTxUrl ||
      data.integration.onChain.explorerUrl ||
      recent.explorerUrl ||
      "/stats",
    reportHref: `/receipt/${analysisId}`,
    signedBy: latest?.submitter ?? null,
    signatureVerified:
      latest?.signatureVerified ??
      data.integration.onChain.operatorAuthentication.signatureVerified,
  };
}

export default async function LandingPage() {
  const data = await getJudgeData();
  const latestAnalysis = getLatestAnalysis(data);
  const totalAnalyses = data?.analysisCount ?? 0;
  const signedPercentage = data?.integration.onChain.operatorAuthentication.signatureVerified ? 100 : 0;
  const totalMemory = data?.memory.totalRecords ?? 0;
  const runtimeMemory = data?.memory.runtimeGeneratedCount ?? 0;
  const seedMemory = data?.memory.seedCount ?? 0;
  const contractAddress =
    data?.integration.onChain.contractAddress ??
    "0x24bAAC6720ae5B01A1CC90eCC1C15AFcb903E121";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--cm-background)] text-[var(--cm-text-primary)]">
      <LandingNav />
      <HeroSection
        eyebrow="AGENTIC INFRASTRUCTURE · 0G MAINNET · OPEN SOURCE"
        headline="Multi-agent Web3 due diligence with on-chain verifiable receipts."
        subhead="Specialized agents — Planner, Researcher, Risk, Architect, Critic, Final — analyze a Web3 project end-to-end. Each report is hashed, signed by an authorized operator, and recorded on 0G Chain."
        primaryCta={{ label: "Run analysis →", href: "/analysis" }}
        secondaryCta={{ label: "See live data ↗", href: "/stats" }}
      />
      <LiveTicker
        latestAnalysis={latestAnalysis}
        totalAnalyses={totalAnalyses}
        signedPercentage={signedPercentage}
        fallbackMessage={`${totalAnalyses} total analyses · ${signedPercentage}% signed · view all ↗`}
        memoryRecords={totalMemory}
        networkLabel="0G mainnet"
      />

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-14 sm:px-8 lg:grid-cols-3 lg:px-10">
        <FeatureCard
          title="Critic challenges every conclusion"
          description="Final score is not just an LLM verdict. A separate Critic agent finds gaps in other agents' reasoning. Each unresolved challenge mathematically lowers score."
          visualType="score-math"
          visualData={{
            initialScore: 70,
            highSeverity: 1,
            mediumSeverity: 1,
            finalScore: 48,
          }}
        />
        <FeatureCard
          title="Every report is signed and on-chain"
          description="Reports are hashed, signed by an authorized operator with EIP-712, and recorded in a smart contract on 0G Chain. You can verify integrity without trusting us."
          visualType="receipt"
          visualData={{
            signedBy: "0x9A0C8040A8C6aB9F65F544578b891Fba599799F8",
            rootHash: latestAnalysis?.rootHash ?? "0xdc97f335dc97f335",
            contract: contractAddress,
          }}
        />
        <FeatureCard
          title="Semantic memory tracks reusable context"
          description="ClawMind keeps a deduplicated 0G-backed memory index: seed precedents plus runtime records from prior analyses. It is reusable context, not a 1:1 count of the current registry."
          visualType="memory"
          visualData={{
            totalRecords: totalMemory,
            seedRecords: seedMemory,
            runtimeRecords: runtimeMemory,
            deduped: true,
          }}
        />
      </section>

      <McpIntegrationBlock
        endpointUrl="https://clawmind-mcp.vercel.app/sse"
        clientIdExample="your-client-id"
      />
      <LandingFooter version={packageJson.version} buildHash={shortBuildHash()} />
    </main>
  );
}
