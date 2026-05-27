import { StatsDashboard, type StatsJudgeData } from "@/components/StatsDashboard";
import packageJson from "@/package.json";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.CLAWMIND_APP_BASE_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://clawmind-puce.vercel.app";
}

async function getJudgeData(): Promise<StatsJudgeData | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/judge`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<StatsJudgeData>;
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

export default async function StatsPage() {
  const data = await getJudgeData();

  return (
    <StatsDashboard
      data={data}
      version={packageJson.version}
      buildHash={shortBuildHash()}
    />
  );
}
