import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      task?: string;
      report?: {
        summary?: string;
        score?: number;
        recommendation?: string;
        risks?: { title: string; severity: string; explanation: string }[];
        opportunities?: string[];
        architecture?: string[];
        nextSteps?: string[];
        evidence?: string[];
      };
      receipt?: {
        reportHash?: string;
        storageUri?: string;
        provider?: string;
      };
      onChainReceipt?: {
        txHash?: string;
        analysisId?: number;
        contractAddress?: string;
        explorerTxUrl?: string;
        provider?: string;
      };
    };

    const { task, report, receipt, onChainReceipt } = body;

    if (!report || !task) {
      return NextResponse.json(
        { error: "Missing required fields: task, report" },
        { status: 400 }
      );
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 55, right: 55 },
      info: {
        Title: `ClawMind Analysis Report`,
        Author: "ClawMind - AI-Powered Web3 Risk Analysis",
        Subject: task,
      },
    });

    // Collect PDF chunks into a buffer
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Helper: colored section heading
    function sectionHeading(text: string) {
      doc.moveDown(0.8);
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#7c3aed")
        .text(text.toUpperCase(), { underline: false });
      doc.moveDown(0.3);
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - 55, doc.y)
        .stroke();
      doc.moveDown(0.4);
    }

    // Helper: bullet item
    function bulletItem(text: string, indent = 20) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#374151")
        .text(`  \u2022  ${text}`, doc.page.margins.left + indent, undefined, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - indent,
          lineGap: 2,
        });
    }

    // ---- COVER / HEADER ----
    doc.rect(0, 0, doc.page.width, 120).fill("#1e1b4b");
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#ffffff").text("ClawMind", 55, 35);
    doc.fontSize(11).font("Helvetica").fillColor("#c4b5fd").text("AI-Powered Web3 Risk Analysis Report", 55, 65);
    doc.fontSize(9).fillColor("#a78bfa").text(new Date().toISOString(), 55, 85);

    doc.y = 140;

    // ---- TASK ----
    sectionHeading("Analyzed Task");
    doc.fontSize(10).font("Helvetica").fillColor("#1f2937").text(task, { lineGap: 2 });

    // ---- SCORE & RECOMMENDATION ----
    doc.moveDown(0.5);
    const scoreColor = (report.score ?? 0) >= 70 ? "#059669" : (report.score ?? 0) >= 40 ? "#d97706" : "#dc2626";
    const recColor = report.recommendation === "GO" ? "#059669" : report.recommendation === "NO_GO" ? "#dc2626" : "#d97706";

    const boxY = doc.y;
    doc.rect(55, boxY, 220, 45).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#6b7280").text("SCORE", 70, boxY + 8);
    doc.fontSize(18).font("Helvetica-Bold").fillColor(scoreColor).text(`${report.score ?? 0}/100`, 70, boxY + 22);

    doc.rect(290, boxY, 220, 45).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#6b7280").text("RECOMMENDATION", 305, boxY + 8);
    doc.fontSize(16).font("Helvetica-Bold").fillColor(recColor).text(report.recommendation ?? "N/A", 305, boxY + 23);

    doc.y = boxY + 60;

    // ---- SUMMARY ----
    sectionHeading("Summary");
    doc.fontSize(10).font("Helvetica").fillColor("#1f2937").text(report.summary ?? "", { lineGap: 2 });

    // ---- RISKS ----
    if (report.risks && report.risks.length > 0) {
      sectionHeading("Risk Map");
      for (const risk of report.risks) {
        const sevColor = risk.severity === "critical" ? "#dc2626" : risk.severity === "high" ? "#ea580c" : risk.severity === "medium" ? "#d97706" : "#059669";
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937").text(risk.title, { continued: true }).font("Helvetica").fillColor(sevColor).text(`  [${risk.severity.toUpperCase()}]`);
        doc.fontSize(9).font("Helvetica").fillColor("#4b5563").text(risk.explanation, { lineGap: 1 });
        doc.moveDown(0.3);
      }
    }

    // ---- OPPORTUNITIES ----
    if (report.opportunities && report.opportunities.length > 0) {
      sectionHeading("Opportunities");
      for (const opp of report.opportunities) { bulletItem(opp); }
    }

    // ---- ARCHITECTURE ----
    if (report.architecture && report.architecture.length > 0) {
      sectionHeading("Architecture");
      for (const arch of report.architecture) { bulletItem(arch); }
    }

    // ---- NEXT STEPS ----
    if (report.nextSteps && report.nextSteps.length > 0) {
      sectionHeading("Next Steps");
      report.nextSteps.forEach((step, i) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#7c3aed").text(`${i + 1}. `, doc.page.margins.left + 10, undefined, { continued: true }).font("Helvetica").fillColor("#374151").text(step, { lineGap: 2 });
      });
    }

    // ---- EVIDENCE LOG ----
    if (report.evidence && report.evidence.length > 0) {
      sectionHeading("Evidence Log");
      for (const ev of report.evidence) { bulletItem(ev); }
    }

    // ---- INFRASTRUCTURE / RECEIPTS ----
    if (receipt || onChainReceipt) {
      sectionHeading("Infrastructure Receipts");
      if (receipt) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937").text("0G Storage");
        doc.fontSize(9).font("Helvetica").fillColor("#4b5563");
        if (receipt.reportHash) doc.text(`  Report Hash: ${receipt.reportHash}`);
        if (receipt.storageUri) doc.text(`  Storage URI: ${receipt.storageUri}`);
        if (receipt.provider) doc.text(`  Provider: ${receipt.provider}`);
        doc.moveDown(0.4);
      }
      if (onChainReceipt) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937").text("On-Chain Registration");
        doc.fontSize(9).font("Helvetica").fillColor("#4b5563");
        if (onChainReceipt.analysisId !== undefined) doc.text(`  Analysis ID: ${onChainReceipt.analysisId}`);
        if (onChainReceipt.txHash) doc.text(`  TX Hash: ${onChainReceipt.txHash}`);
        if (onChainReceipt.contractAddress) doc.text(`  Contract: ${onChainReceipt.contractAddress}`);
        if (onChainReceipt.explorerTxUrl) doc.text(`  Explorer: ${onChainReceipt.explorerTxUrl}`);
        if (onChainReceipt.provider) doc.text(`  Provider: ${onChainReceipt.provider}`);
        doc.moveDown(0.4);
      }
    }

    // ---- FOOTER ----
    doc.moveDown(2);
    doc.fontSize(7).font("Helvetica").fillColor("#9ca3af").text("Generated by ClawMind — AI-Powered Web3 Risk Analysis | Powered by 0G Compute + Storage + Chain", { align: "center" });

    // Finalize PDF
    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="clawmind-report-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF generation error";
    console.error("[PDF Route] Generation failed:", message);
    return NextResponse.json({ error: "PDF generation failed", details: message }, { status: 500 });
  }
}