import ExcelJS from "exceljs";
import { MotherSummaryData } from "./motherSummaryData";

const NAVY = "FF1F3864";
const LIGHT_BLUE = "FFD9E2F3";
const WHITE = "FFFFFFFF";

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
const yn = (b: boolean) => (b ? "Yes" : "No");

function styleSectionHeader(ws: ExcelJS.Worksheet, row: number, span: number, text: string) {
  ws.mergeCells(row, 1, row, span);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: "Arial", size: 12, bold: true, color: { argb: WHITE } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 22;
}

function styleLabelValueRow(
  ws: ExcelJS.Worksheet,
  row: number,
  pairs: Array<[string, string]>
) {
  let col = 1;
  for (const [label, value] of pairs) {
    const lc = ws.getCell(row, col);
    lc.value = label;
    lc.font = { name: "Arial", size: 10, bold: true };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    lc.border = thinBorder();

    const vc = ws.getCell(row, col + 1);
    vc.value = value;
    vc.font = { name: "Arial", size: 10 };
    vc.border = thinBorder();
    col += 2;
  }
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: "thin", color: { argb: "FFBFBFBF" } };
  return { top: side, bottom: side, left: side, right: side };
}

function styleTableHeader(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.border = thinBorder();
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 26;
}

function styleTableRow(ws: ExcelJS.Worksheet, row: number, values: (string | number)[]) {
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    cell.font = { name: "Arial", size: 10 };
    cell.border = thinBorder();
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
}

/**
 * Renders one mother's full summary into the given worksheet, starting at row 1.
 * Shared by both single-mother and all-mothers export paths.
 */
function renderMotherSheet(ws: ExcelJS.Worksheet, m: MotherSummaryData, generatedAt: Date) {
  const span = 8;
  for (let c = 1; c <= span; c++) {
    ws.getColumn(c).width = 20;
  }

  ws.mergeCells(1, 1, 2, span);
  const title = ws.getCell(1, 1);
  title.value = "MOTHER'S SUMMARY REPORT";
  title.font = { name: "Arial", size: 16, bold: true, color: { argb: WHITE } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 20;
  ws.getRow(2).height = 20;

  let row = 4;
  styleLabelValueRow(ws, row, [["Report Generated", generatedAt.toISOString().slice(0, 10)], ["Assigned Midwife", m.assignedMidwifeName ?? "-"]]);
  row++;

  row++;
  styleSectionHeader(ws, row, span, "1. Identification"); row++;
  styleLabelValueRow(ws, row, [["Full Name", m.fullName], ["NIC Number", m.nicNumber]]); row++;
  styleLabelValueRow(ws, row, [["MOH Reg. Number", m.mohRegNumber], ["Date of Birth", fmtDate(m.dateOfBirth)]]); row++;
  styleLabelValueRow(ws, row, [["Contact Number", m.contactNumber ?? "-"], ["Address", m.address ?? "-"]]); row++;
  styleLabelValueRow(ws, row, [["Blood Group", m.bloodGroup ?? "-"], ["Height (cm)", m.heightCm?.toString() ?? "-"]]); row++;
  styleLabelValueRow(ws, row, [["Needs Special Attention", yn(m.needsSpecialAttention)], ["Allergies", m.allergies ?? "None reported"]]); row++;
  styleLabelValueRow(ws, row, [["Emergency Contact Name", m.emergencyName ?? "-"], ["Emergency Contact Number", m.emergencyContact ?? "-"]]); row++;
  styleLabelValueRow(ws, row, [["Medical History", m.medicalHistory ?? "-"], ["", ""]]); row++;

  row++;
  styleSectionHeader(ws, row, span, "2. Pregnancy Overview"); row++;
  if (m.activePregnancy) {
    const p = m.activePregnancy;
    styleLabelValueRow(ws, row, [["Status", p.status], ["LMP", fmtDate(p.lastMenstrualPeriod)]]); row++;
    styleLabelValueRow(ws, row, [["EDD", fmtDate(p.expectedDeliveryDate)], ["Current Week", p.currentWeek?.toString() ?? "-"]]); row++;
    styleLabelValueRow(ws, row, [["High Risk", yn(p.highRisk)], ["High Risk Reasons", p.highRiskReasons ?? "-"]]); row++;
    styleLabelValueRow(ws, row, [["Medical Notes", p.medicalNotes ?? "-"], ["", ""]]); row++;
  } else {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No active pregnancy record.";
    ws.getCell(row, 1).font = { name: "Arial", size: 10, italic: true };
    row++;
  }

  row++;
  styleSectionHeader(ws, row, span, "3. Antenatal Visit History (selected date range)"); row++;
  styleTableHeader(ws, row, ["Visit Date", "Status", "Blood Pressure", "Weight (kg)", "Temp (°C)", "Fetal HR", "Symptoms", "Recommendations"]); row++;
  if (m.antenatalVisits.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No antenatal visits in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const v of m.antenatalVisits) {
      styleTableRow(ws, row, [
        fmtDate(v.visitDate), v.status, v.bloodPressure ?? "-",
        v.weight ?? "-", v.temperature ?? "-", v.fetalHeartRate ?? "-",
        v.symptoms ?? "-", v.recommendations ?? "-",
      ]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "4. Mother Growth Records (selected date range)"); row++;
  styleTableHeader(ws, row, ["Record Date", "Weight (kg)", "SFH (cm)", "Recorded By", "Notes", "", "", ""]); row++;
  if (m.motherGrowthRecords.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No growth records in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const g of m.motherGrowthRecords) {
      styleTableRow(ws, row, [fmtDate(g.recordDate), g.weightKg, g.sfhCm ?? "-", g.recordedByName, g.notes ?? "-", "", "", ""]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "5. Postnatal Visit History (selected date range)"); row++;
  styleTableHeader(ws, row, ["Visit Date", "Visit No.", "Window Start", "Window End", "Mandatory?", "Status", "Weight (kg)", "Notes"]); row++;
  if (m.postnatalVisits.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No postnatal visits in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const v of m.postnatalVisits) {
      styleTableRow(ws, row, [
        fmtDate(v.visitDate), v.postnatalVisitNumber ?? "-",
        fmtDate(v.postnatalWindowStart), fmtDate(v.postnatalWindowEnd),
        yn(v.isPostnatalMandatory), v.status, v.weight ?? "-", v.notes ?? "-",
      ]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "6. Vaccinations (selected date range)"); row++;
  styleTableHeader(ws, row, ["Vaccine Name", "Scheduled Date", "Administered Date", "Status", "Batch No.", "Administered By", "Notes", ""]); row++;
  if (m.vaccinations.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No vaccinations in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const v of m.vaccinations) {
      styleTableRow(ws, row, [
        v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.administeredDate),
        v.status, v.batchNumber ?? "-", v.administeredBy ?? "-", v.notes ?? "-", "",
      ]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "7. Thriposha Distribution (selected date range)"); row++;
  styleTableHeader(ws, row, ["Distribution Date", "Month/Year", "Packet Type", "Quantity", "Batch No.", "Notes", "", ""]); row++;
  if (m.thriposhaDistributions.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No Thriposha distributions in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const t of m.thriposhaDistributions) {
      styleTableRow(ws, row, [
        fmtDate(t.distributionDate), `${t.month}/${t.year}`, t.packetType,
        t.quantity, t.batchNumber ?? "-", t.notes ?? "-", "", "",
      ]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "8. Children Summary"); row++;
  styleTableHeader(ws, row, ["Child Name", "Gender", "Birth Date", "Birth Weight (kg)", "Gestational Age (wks)", "Preterm?", "Health Notes", ""]); row++;
  if (m.children.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No children on record.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const c of m.children) {
      styleTableRow(ws, row, [
        c.name, c.gender, fmtDate(c.birthDate), c.birthWeight ?? "-",
        c.gestationalAgeWeeks ?? "-", yn(c.isPreterm), c.healthNotes ?? "-", "",
      ]);
      row++;
    }
  }

  row++;
  styleSectionHeader(ws, row, span, "9. Documents Uploaded (selected date range)"); row++;
  styleTableHeader(ws, row, ["File Name", "Document Type", "Uploaded Date", "", "", "", "", ""]); row++;
  if (m.documents.length === 0) {
    ws.mergeCells(row, 1, row, span);
    ws.getCell(row, 1).value = "No documents uploaded in this date range.";
    ws.getCell(row, 1).font = { name: "Arial", size: 9, italic: true };
    row++;
  } else {
    for (const d of m.documents) {
      styleTableRow(ws, row, [d.fileName, d.documentTypeName, fmtDate(d.uploadedAt), "", "", "", "", ""]);
      row++;
    }
  }
}

/** Sheet names must be <=31 chars and can't contain: \ / * ? : [ ] */
function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Builds the workbook. One worksheet per mother — works for both
 * a single mother (workbook with 1 sheet) and all mothers (1 sheet each).
 */
export async function buildMotherSummaryWorkbook(
  mothers: MotherSummaryData[],
  generatedAt: Date = new Date()
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CareNest";
  wb.created = generatedAt;

  const usedNames = new Set<string>();
  mothers.forEach((m, i) => {
    let name = safeSheetName(m.fullName, `Mother ${i + 1}`);
    let suffix = 1;
    while (usedNames.has(name)) {
      name = safeSheetName(`${m.fullName} (${++suffix})`, `Mother ${i + 1} (${suffix})`);
    }
    usedNames.add(name);
    const ws = wb.addWorksheet(name);
    ws.views = [{ showGridLines: false }];
    renderMotherSheet(ws, m, generatedAt);
  });

  if (mothers.length === 0) {
    const ws = wb.addWorksheet("Summary");
    ws.getCell(1, 1).value = "No mothers matched the selected filters.";
  }

  return wb;
}
