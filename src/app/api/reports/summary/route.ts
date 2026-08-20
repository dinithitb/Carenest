import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMotherSummaryData, resolveDateRange, DateRangeKey } from "@/lib/reports/motherSummaryData";
import { buildMotherSummaryWorkbook } from "@/lib/reports/motherSummaryExcel";
import { buildMotherSummaryPdf } from "@/lib/reports/motherSummaryPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_RANGES: DateRangeKey[] = [
  "last7",
  "last30",
  "last90",
  "last365",
  "week",
  "month",
  "quarter",
  "year",
  "custom",
  "all",
];

function asDownloadBody(data: ArrayBuffer | Buffer | Uint8Array): BodyInit {
  if (Buffer.isBuffer(data)) {
    return data as unknown as BodyInit;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data) as unknown as BodyInit;
  }
  return Buffer.from(new Uint8Array(data)) as unknown as BodyInit;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["MIDWIFE", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");
    const motherId = searchParams.get("motherId") || undefined;
    const range = (searchParams.get("range") ?? "last30") as DateRangeKey;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    if (format !== "xlsx" && format !== "pdf") {
      return NextResponse.json({ error: "format must be 'xlsx' or 'pdf'" }, { status: 400 });
    }
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: `range must be one of: ${VALID_RANGES.join(", ")}` }, { status: 400 });
    }

    let resolvedRange;
    try {
      resolvedRange = resolveDateRange({ range, startDate, endDate });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const assignedMidwifeId =
      session.user.role === "MIDWIFE" ? session.user.midwifeId : undefined;

    if (session.user.role === "MIDWIFE" && !assignedMidwifeId) {
      return NextResponse.json({ error: "Midwife profile is not linked to this account" }, { status: 403 });
    }

    const mothers = await getMotherSummaryData(resolvedRange, {
      motherId,
      assignedMidwifeId,
    });

    if (motherId && mothers.length === 0) {
      return NextResponse.json({ error: "Mother not found or not accessible" }, { status: 404 });
    }

    const generatedAt = new Date();
    const datePart = generatedAt.toISOString().slice(0, 10);
    const scopePart = motherId && mothers[0] ? mothers[0].fullName.replace(/\s+/g, "_") : "all-mothers";
    const baseFilename = `mothers-summary-report-${scopePart}-${datePart}`;

    if (format === "xlsx") {
      const workbook = await buildMotherSummaryWorkbook(mothers, generatedAt);
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(asDownloadBody(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
        },
      });
    }

    const pdfBuffer = await buildMotherSummaryPdf(mothers, generatedAt);
    return new NextResponse(asDownloadBody(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[Mother Summary Report]", error);
    const message = error instanceof Error ? error.message : "Failed to generate summary report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
