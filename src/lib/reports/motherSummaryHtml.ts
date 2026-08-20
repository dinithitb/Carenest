import { MotherSummaryData } from "./motherSummaryData";

const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "-");
const yn = (b: boolean) => (b ? "Yes" : "No");
const esc = (v: unknown) =>
  String(v ?? "-").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function table(headers: string[], rows: (string | number)[][], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${esc(emptyMessage)}</p>`;
  }
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`;
}

function labelValue(pairs: Array<[string, unknown]>): string {
  return `
    <div class="lv-grid">
      ${pairs
        .map(
          ([label, value]) => `
        <div class="lv-pair">
          <div class="lv-label">${esc(label)}</div>
          <div class="lv-value">${esc(value)}</div>
        </div>`
        )
        .join("")}
    </div>`;
}

function renderMotherSection(m: MotherSummaryData, generatedAt: Date): string {
  const p = m.activePregnancy;
  return `
  <section class="mother-report">
    <div class="title-banner">MOTHER'S SUMMARY REPORT</div>
    ${labelValue([
      ["Report Generated", generatedAt.toISOString().slice(0, 10)],
      ["Assigned Midwife", m.assignedMidwifeName ?? "-"],
    ])}

    <h2>1. Identification</h2>
    ${labelValue([
      ["Full Name", m.fullName],
      ["NIC Number", m.nicNumber],
      ["MOH Reg. Number", m.mohRegNumber],
      ["Date of Birth", fmtDate(m.dateOfBirth)],
      ["Contact Number", m.contactNumber],
      ["Address", m.address],
      ["Blood Group", m.bloodGroup],
      ["Height (cm)", m.heightCm],
      ["Needs Special Attention", yn(m.needsSpecialAttention)],
      ["Allergies", m.allergies ?? "None reported"],
      ["Emergency Contact Name", m.emergencyName],
      ["Emergency Contact Number", m.emergencyContact],
      ["Medical History", m.medicalHistory],
    ])}

    <h2>2. Pregnancy Overview</h2>
    ${
      p
        ? labelValue([
            ["Status", p.status],
            ["LMP", fmtDate(p.lastMenstrualPeriod)],
            ["EDD", fmtDate(p.expectedDeliveryDate)],
            ["Current Week", p.currentWeek],
            ["High Risk", yn(p.highRisk)],
            ["High Risk Reasons", p.highRiskReasons],
            ["Medical Notes", p.medicalNotes],
          ])
        : `<p class="empty">No active pregnancy record.</p>`
    }

    <h2>3. Antenatal Visit History <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["Visit Date", "Status", "BP", "Weight (kg)", "Temp (°C)", "Fetal HR", "Symptoms", "Recommendations"],
      m.antenatalVisits.map((v) => [
        fmtDate(v.visitDate), v.status, v.bloodPressure ?? "-", v.weight ?? "-",
        v.temperature ?? "-", v.fetalHeartRate ?? "-", v.symptoms ?? "-", v.recommendations ?? "-",
      ]),
      "No antenatal visits in this date range."
    )}

    <h2>4. Mother Growth Records <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["Record Date", "Weight (kg)", "SFH (cm)", "Recorded By", "Notes"],
      m.motherGrowthRecords.map((g) => [fmtDate(g.recordDate), g.weightKg, g.sfhCm ?? "-", g.recordedByName, g.notes ?? "-"]),
      "No growth records in this date range."
    )}

    <h2>5. Postnatal Visit History <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["Visit Date", "Visit No.", "Window Start", "Window End", "Mandatory?", "Status", "Weight (kg)", "Notes"],
      m.postnatalVisits.map((v) => [
        fmtDate(v.visitDate), v.postnatalVisitNumber ?? "-", fmtDate(v.postnatalWindowStart),
        fmtDate(v.postnatalWindowEnd), yn(v.isPostnatalMandatory), v.status, v.weight ?? "-", v.notes ?? "-",
      ]),
      "No postnatal visits in this date range."
    )}

    <h2>6. Vaccinations <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["Vaccine Name", "Scheduled Date", "Administered Date", "Status", "Batch No.", "Administered By", "Notes"],
      m.vaccinations.map((v) => [
        v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.administeredDate),
        v.status, v.batchNumber ?? "-", v.administeredBy ?? "-", v.notes ?? "-",
      ]),
      "No vaccinations in this date range."
    )}

    <h2>7. Thriposha Distribution <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["Distribution Date", "Month/Year", "Packet Type", "Quantity", "Batch No.", "Notes"],
      m.thriposhaDistributions.map((t) => [
        fmtDate(t.distributionDate), `${t.month}/${t.year}`, t.packetType, t.quantity, t.batchNumber ?? "-", t.notes ?? "-",
      ]),
      "No Thriposha distributions in this date range."
    )}

    <h2>8. Children Summary</h2>
    ${table(
      ["Child Name", "Gender", "Birth Date", "Birth Weight (kg)", "Gest. Age (wks)", "Preterm?", "Health Notes"],
      m.children.map((c) => [
        c.name, c.gender, fmtDate(c.birthDate), c.birthWeight ?? "-",
        c.gestationalAgeWeeks ?? "-", yn(c.isPreterm), c.healthNotes ?? "-",
      ]),
      "No children on record."
    )}

    <h2>9. Documents Uploaded <span class="range-note">(selected date range)</span></h2>
    ${table(
      ["File Name", "Document Type", "Uploaded Date"],
      m.documents.map((d) => [d.fileName, d.documentTypeName, fmtDate(d.uploadedAt)]),
      "No documents uploaded in this date range."
    )}
  </section>`;
}

export function renderMotherSummaryHtml(mothers: MotherSummaryData[], generatedAt: Date = new Date()): string {
  const body =
    mothers.length === 0
      ? `<p class="empty">No mothers matched the selected filters.</p>`
      : mothers.map((m) => renderMotherSection(m, generatedAt)).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; font-size: 11px; }
  .mother-report { page-break-after: always; }
  .mother-report:last-child { page-break-after: auto; }
  .title-banner {
    background: #1F3864; color: #fff; font-size: 18px; font-weight: bold;
    text-align: center; padding: 14px; margin-bottom: 12px; border-radius: 4px;
  }
  h2 {
    background: #1F3864; color: #fff; font-size: 12px; padding: 6px 10px;
    margin: 16px 0 8px; border-radius: 3px;
  }
  .range-note { font-weight: normal; font-size: 10px; opacity: 0.85; }
  .lv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-bottom: 6px; }
  .lv-pair { display: flex; border: 1px solid #ddd; }
  .lv-label { background: #D9E2F3; font-weight: bold; padding: 4px 8px; width: 45%; }
  .lv-value { padding: 4px 8px; width: 55%; background: #fff; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1F3864; color: #fff; padding: 5px; font-size: 9.5px; text-align: center; }
  td { border: 1px solid #ddd; padding: 5px; font-size: 9.5px; text-align: center; }
  tr:nth-child(even) td { background: #f7f8fb; }
  .empty { font-style: italic; color: #888; font-size: 10px; margin: 4px 0 10px; }
</style>
</head>
<body>
  ${body}
</body>
</html>`;
}