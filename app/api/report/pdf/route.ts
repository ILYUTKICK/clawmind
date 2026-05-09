// ---------------------------------------------------------------------------
// ClawMind — PDF Report Export API
// ---------------------------------------------------------------------------
// Generates a downloadable PDF report for a given analysis.
// Uses pdfkit for server-side PDF generation without a headless browser.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

// Simple QR code generator (using a text-based representation)
// For production, use a real QR library — but for a hackathon demo,
// we embed the explorer URL as a clickable link instead.
function getExplorerUrl(txHash: string): string {
  return `https://chainscan.0g.ai/tx/${txHash}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      task?: string;
      report?: {
        summary?: string;
        score?: number;
        recommendation?: string;
        risks?: Array<{ title: string; severity: string; explanation: string }>;
        opportunities?: string[];
        architecture?: string[];
        nextSteps?: string[];
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

    if (!body.report || !body.task) {
      return NextResponse.json(
        { error: "Missing report or task data" },
        { status: 400 }
      );
    }

    const { task, report, receipt, onChainReceipt } = body;

    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `ClawMind Analysis Report — ${task.slice(0, 50)}`,
        Author: "ClawMind Multi-Agent Pipeline",
        Subject: "Web3 Risk Analysis Report",
        Creator: "ClawMind v1.1.0",
      },
    });

    // Collect PDF data in a buffer
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // ─── Helper functions ───

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function addHeader(text: string, size: number = 16) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(size).fillColor("#1a1a2e").text(text);
      doc.moveDown(0.3);
      // Underline
      doc.strokeColor("#00d4ff").lineWidth(1.5)
        .moveTo(doc.x, doc.y)
        .lineTo(doc.x + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.5);
    }

    function addText(text: string, size: number = 10, bold: boolean = false, color: string = "#333333") {
      const font = bold ? "Helvetica-Bold" : "Helvetica";
      doc.font(font).fontSize(size).fillColor(color).text(text, { lineGap: 3 });
    }

    function addBullet(text: string, indent: number = 20) {
      const x = doc.x;
      doc.font("Helvetica").fontSize(10).fillColor("#555555")
        .text(`  \u2022  ${text}`, doc.x + indent, doc.y, { width: pageWidth - indent, lineGap: 2 });
    }

    function checkPageBreak(needed: number = 100) {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    }

    // ─── Page 1: Cover & Summary ───

    // Logo/brand area
    doc.font("Helvetica-Bold").fontSize(28).fillColor("#1a1a2e")
      .text("ClawMind", { align: "center" });
    doc.font("Helvetica").fontSize(11).fillColor("#666666")
      .text("Audit-Grade Risk Reports for Web3 Protocols", { align: "center" });
    doc.moveDown(0.5);

    // Horizontal separator
    doc.strokeColor("#00d4ff").lineWidth(2)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(1);

    // Task
    addHeader("Analyzed Task", 14);
    addText(task, 11);

    doc.moveDown(1);

    // Score box
    if (report.score !== undefined) {
      const scoreColor = report.score >= 70 ? "#22c55e" : report.score >= 40 ? "#eab308" : "#ef4444";
      doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 50, 8)
        .fillAndStroke("#f8f9fa", scoreColor);

      doc.font("Helvetica-Bold").fontSize(24).fillColor(scoreColor)
        .text(`${report.score}/100`, doc.page.margins.left + 20, doc.y - 42, { continued: true });
      doc.font("Helvetica").fontSize(14).fillColor("#333333")
        .text(`   Recommendation: ${report.recommendation || "N/A"}`);
      doc.y += 20;
    }

    doc.moveDown(1);

    // Summary
    if (report.summary) {
      addHeader("Summary", 14);
      addText(report.summary, 10);
    }

    // ─── Risks ───

    if (report.risks && report.risks.length > 0) {
      checkPageBreak(200);
      addHeader("Risk Map", 14);

      for (const risk of report.risks) {
        checkPageBreak(60);
        const severityColors: Record<string, string> = {
          critical: "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#22c55e",
        };
        const sevColor = severityColors[risk.severity?.toLowerCase()] || "#999999";

        doc.font("Helvetica-Bold").fontSize(11).fillColor(sevColor)
          .text(`[${(risk.severity || "UNKNOWN").toUpperCase()}] ${risk.title}`);
        doc.font("Helvetica").fontSize(9.5).fillColor("#555555")
          .text(risk.explanation, { indent: 20, lineGap: 2 });
        doc.moveDown(0.4);
      }
    }

    // ─── Opportunities ───

    if (report.opportunities && report.opportunities.length > 0) {
      checkPageBreak(150);
      addHeader("Opportunities", 14);
      for (const opp of report.opportunities) {
        addBullet(opp);
      }
    }

    // ─── Architecture ───

    if (report.architecture && report.architecture.length > 0) {
      checkPageBreak(150);
      addHeader("Architecture Recommendations", 14);
      for (const arch of report.architecture) {
        addBullet(arch);
      }
    }

    // ─── Next Steps ───

    if (report.nextSteps && report.nextSteps.length > 0) {
      checkPageBreak(150);
      addHeader("Next Steps", 14);
      for (const step of report.nextSteps) {
        addBullet(step);
      }
    }

    // ─── On-Chain Proof & Integrity ───

    checkPageBreak(200);
    addHeader("On-Chain Proof & Integrity", 14);

    if (receipt?.reportHash) {
      addText("Report Hash:", 10, true);
      doc.font("Courier").fontSize(8.5).fillColor("#333333")
        .text(receipt.reportHash, { lineGap: 1 });
      doc.moveDown(0.4);
    }

    if (receipt?.storageUri) {
      addText("Storage URI:", 10, true);
      doc.font("Courier").fontSize(8.5).fillColor("#0066cc")
        .text(receipt.storageUri, { link: receipt.storageUri, underline: true });
      doc.moveDown(0.4);
    }

    if (onChainReceipt?.provider === "0G_CHAIN") {
      addText("On-Chain Registration:", 10, true);
      doc.font("Helvetica").fontSize(9.5).fillColor("#333333");

      if (onChainReceipt.txHash) {
        const explorerUrl = onChainReceipt.explorerTxUrl || getExplorerUrl(onChainReceipt.txHash);
        doc.text(`Transaction: `, { continued: true });
        doc.fillColor("#0066cc").text(onChainReceipt.txHash.slice(0, 20) + "...", {
          link: explorerUrl,
          underline: true,
        });
      }

      if (onChainReceipt.analysisId) {
        doc.fillColor("#333333").text(`Analysis ID: ${onChainReceipt.analysisId}`);
      }

      if (onChainReceipt.contractAddress) {
        doc.text(`Contract: ${onChainReceipt.contractAddress}`);
      }

      doc.moveDown(0.5);

      // QR code placeholder — link to explorer
      if (onChainReceipt.explorerTxUrl) {
        doc.font("Helvetica").fontSize(9).fillColor("#666666")
          .text("Verify on-chain: " + onChainReceipt.explorerTxUrl, {
            link: onChainReceipt.explorerTxUrl,
            underline: true,
          });
      }
    } else {
      addText("On-chain registration: Not available (configure 0G Chain for on-chain proof)", 9, false, "#999999");
    }

    // ─── Footer ───

    doc.moveDown(2);
    doc.strokeColor("#dddddd").lineWidth(0.5)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(8).fillColor("#999999")
      .text(`Generated by ClawMind v1.1.0 | ${new Date().toISOString()}`, { align: "center" });
    doc.text("Powered by 0G Compute, 0G Storage, and 0G Chain", { align: "center" });

    // Finalize PDF
    doc.end();

    // Wait for the document to finish writing to buffer
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);
    });

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="clawmind-report-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PDF] Generation failed:", message);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: message },
      { status: 500 }
    );
  }
}
