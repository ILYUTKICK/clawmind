import type { Recommendation } from "@/lib/types";

export type LandingCta = {
  label: string;
  href: string;
};

export type LandingLatestAnalysis = {
  analysisId: number;
  score: number;
  recommendation: Recommendation;
  timestamp: number;
  rootHash?: string;
  explorerUrl: string;
  reportHref: string;
  signedBy?: string | null;
  signatureVerified?: boolean;
};
