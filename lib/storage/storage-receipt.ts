import { AnalysisReport, StorageReceipt } from "@/lib/types";
import { saveReportToZeroGStorage } from "@/lib/storage/zero-g-storage";

export async function saveAnalysisReceipt(input: {
  task: string;
  report: AnalysisReport;
}): Promise<StorageReceipt> {
  return saveReportToZeroGStorage(input);
}