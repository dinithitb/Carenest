import puppeteer from "puppeteer";
import { MotherSummaryData } from "./motherSummaryData";
import { renderMotherSummaryHtml } from "./motherSummaryHtml";

/**
 * Renders the mother summary report(s) to a PDF buffer.
 * Works identically for a single mother or many — each mother gets its own
 * page (page-break-after in the HTML template handles this).
 */
export async function buildMotherSummaryPdf(
  mothers: MotherSummaryData[],
  generatedAt: Date = new Date()
): Promise<Buffer> {
  const html = renderMotherSummaryHtml(mothers, generatedAt);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}