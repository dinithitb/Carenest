import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/** Values from the reports UI plus the README aliases. */
export type DateRangeKey =
  | "last7"
  | "last30"
  | "last90"
  | "last365"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom"
  | "all";

export interface DateRangeInput {
  range: DateRangeKey;
  startDate?: string; // ISO date, required when range === "custom"
  endDate?: string; // ISO date, required when range === "custom"
}

export interface ResolvedDateRange {
  gte: Date;
  lte: Date;
}

/**
 * Parses YYYY-MM-DD (or ISO) into a local start-of-day or end-of-day bound.
 */
function parseDayBoundary(isoDate: string, endOfDay: boolean): Date {
  const dateOnly = isoDate.slice(0, 10);
  const parts = dateOnly.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const fallback = new Date(isoDate);
    if (Number.isNaN(fallback.getTime())) {
      throw new Error(`Invalid date: ${isoDate}`);
    }
    if (endOfDay) {
      fallback.setHours(23, 59, 59, 999);
    } else {
      fallback.setHours(0, 0, 0, 0);
    }
    return fallback;
  }
  const [year, month, day] = parts;
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

const RANGE_DAYS: Record<string, number> = {
  last7: 7,
  week: 7,
  last30: 30,
  month: 30,
  last90: 90,
  quarter: 90,
  last365: 365,
  year: 365,
};

/**
 * Turns the UI's "Date Range" dropdown value into concrete gte/lte bounds.
 * "all" returns a very wide window so callers can treat it uniformly.
 */
export function resolveDateRange(input: DateRangeInput): ResolvedDateRange {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (input.range === "custom") {
    if (!input.startDate || !input.endDate) {
      throw new Error("startDate and endDate are required when range is 'custom'");
    }
    const gte = parseDayBoundary(input.startDate, false);
    const lte = parseDayBoundary(input.endDate, true);
    if (gte > lte) {
      throw new Error("startDate must be on or before endDate");
    }
    return { gte, lte };
  }

  if (input.range === "all") {
    return { gte: new Date(2000, 0, 1), lte: endOfToday };
  }

  const days = RANGE_DAYS[input.range];
  if (!days) {
    throw new Error(`Unsupported date range: ${input.range}`);
  }
  const start = new Date(endOfToday);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { gte: start, lte: endOfToday };
}

export interface MotherSummaryQueryOptions {
  motherId?: string;
  assignedMidwifeId?: string;
}

export interface MotherSummaryData {
  motherId: string;
  fullName: string;
  nicNumber: string;
  mohRegNumber: string;
  dateOfBirth: Date | null;
  contactNumber: string | null;
  address: string | null;
  bloodGroup: string | null;
  heightCm: number | null;
  needsSpecialAttention: boolean;
  emergencyName: string | null;
  emergencyContact: string | null;
  allergies: string | null;
  medicalHistory: string | null;
  assignedMidwifeName: string | null;

  activePregnancy: {
    status: string;
    lastMenstrualPeriod: Date | null;
    expectedDeliveryDate: Date | null;
    currentWeek: number | null;
    highRisk: boolean;
    highRiskReasons: string | null;
    medicalNotes: string | null;
  } | null;

  antenatalVisits: Array<{
    visitDate: Date;
    status: string;
    bloodPressure: string | null;
    weight: number | null;
    temperature: number | null;
    fetalHeartRate: number | null;
    symptoms: string | null;
    recommendations: string | null;
  }>;

  motherGrowthRecords: Array<{
    recordDate: Date;
    weightKg: number;
    sfhCm: number | null;
    recordedByName: string;
    notes: string | null;
  }>;

  postnatalVisits: Array<{
    visitDate: Date;
    postnatalVisitNumber: number | null;
    postnatalWindowStart: Date | null;
    postnatalWindowEnd: Date | null;
    isPostnatalMandatory: boolean;
    status: string;
    weight: number | null;
    bloodPressure: string | null;
    notes: string | null;
  }>;

  vaccinations: Array<{
    vaccineName: string;
    scheduledDate: Date;
    administeredDate: Date | null;
    status: string;
    batchNumber: string | null;
    administeredBy: string | null;
    notes: string | null;
  }>;

  thriposhaDistributions: Array<{
    distributionDate: Date;
    month: number;
    year: number;
    packetType: string;
    quantity: number;
    batchNumber: string | null;
    notes: string | null;
  }>;

  children: Array<{
    name: string;
    gender: string;
    birthDate: Date;
    birthWeight: number | null;
    gestationalAgeWeeks: number | null;
    isPreterm: boolean;
    healthNotes: string | null;
  }>;

  documents: Array<{
    fileName: string;
    documentTypeName: string;
    uploadedAt: Date;
  }>;
}

/**
 * Fetches everything needed for the Mother's Summary Report.
 *
 * - motherId omitted  -> all mothers (used for the "Summary Report" all-mothers mode)
 * - motherId provided -> single mother
 *
 * dateRange filters activity records ONLY (visits, vaccinations, Thriposha,
 * mother growth records, documents). Identification and pregnancy overview
 * fields are always the mother's current/latest data regardless of range.
 */
export async function getMotherSummaryData(
  dateRange: ResolvedDateRange,
  options: MotherSummaryQueryOptions = {}
): Promise<MotherSummaryData[]> {
  const where: Prisma.MotherWhereInput = {};
  if (options.motherId) {
    where.id = options.motherId;
  }
  if (options.assignedMidwifeId) {
    where.assignedMidwifeId = options.assignedMidwifeId;
  }

  const mothers = await prisma.mother.findMany({
    where,
    orderBy: { user: { name: "asc" } },
    include: {
      user: true,
      assignedMidwife: { include: { user: true } },
      pregnancies: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      visits: {
        where: { visitDate: { gte: dateRange.gte, lte: dateRange.lte } },
        orderBy: { visitDate: "asc" },
      },
      motherGrowthRecords: {
        where: { recordDate: { gte: dateRange.gte, lte: dateRange.lte } },
        include: { recordedBy: { include: { user: true } } },
        orderBy: { recordDate: "asc" },
      },
      vaccinations: {
        where: { scheduledDate: { gte: dateRange.gte, lte: dateRange.lte } },
        orderBy: { scheduledDate: "asc" },
      },
      thriposhaDistributions: {
        where: { distributionDate: { gte: dateRange.gte, lte: dateRange.lte } },
        orderBy: { distributionDate: "asc" },
      },
      children: true,
      documents: {
        where: { uploadedAt: { gte: dateRange.gte, lte: dateRange.lte } },
        include: { documentType: true },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  return mothers.map((m) => {
    const pregnancy = m.pregnancies[0] ?? null;

    return {
      motherId: m.id,
      fullName: m.user.name,
      nicNumber: m.nicNumber,
      mohRegNumber: m.mohRegNumber,
      dateOfBirth: m.dateOfBirth,
      contactNumber: m.user.phone,
      address: m.user.address,
      bloodGroup: m.bloodGroup,
      heightCm: m.height ? Number(m.height) : null,
      needsSpecialAttention: m.needsSpecialAttention,
      emergencyName: m.emergencyName,
      emergencyContact: m.emergencyContact,
      allergies: m.allergies,
      medicalHistory: m.medicalHistory,
      assignedMidwifeName: m.assignedMidwife?.user.name ?? null,

      activePregnancy: pregnancy
        ? {
            status: pregnancy.status,
            lastMenstrualPeriod: pregnancy.lastMenstrualPeriod,
            expectedDeliveryDate: pregnancy.expectedDeliveryDate,
            currentWeek: pregnancy.currentWeek,
            highRisk: pregnancy.highRisk,
            highRiskReasons: pregnancy.highRiskReasons,
            medicalNotes: pregnancy.medicalNotes,
          }
        : null,

      antenatalVisits: m.visits
        .filter((v) => v.visitType === "ANTENATAL")
        .map((v) => ({
          visitDate: v.visitDate,
          status: String(v.status),
          bloodPressure: v.bloodPressure,
          weight: v.weight ? Number(v.weight) : null,
          temperature: v.temperature ? Number(v.temperature) : null,
          fetalHeartRate: v.fetalHeartRate,
          symptoms: v.symptoms,
          recommendations: v.recommendations,
        })),

      motherGrowthRecords: m.motherGrowthRecords.map((g) => ({
        recordDate: g.recordDate,
        weightKg: Number(g.weightKg),
        sfhCm: g.sfhCm ? Number(g.sfhCm) : null,
        recordedByName: g.recordedBy.user.name,
        notes: g.notes,
      })),

      postnatalVisits: m.visits
        .filter((v) => v.visitType === "POSTNATAL")
        .map((v) => ({
          visitDate: v.visitDate,
          postnatalVisitNumber: v.postnatalVisitNumber,
          postnatalWindowStart: v.postnatalWindowStart,
          postnatalWindowEnd: v.postnatalWindowEnd,
          isPostnatalMandatory: v.isPostnatalMandatory,
          status: String(v.status),
          weight: v.weight ? Number(v.weight) : null,
          bloodPressure: v.bloodPressure,
          notes: v.notes,
        })),

      vaccinations: m.vaccinations.map((vac) => ({
        vaccineName: vac.vaccineName,
        scheduledDate: vac.scheduledDate,
        administeredDate: vac.administeredDate,
        status: String(vac.status),
        batchNumber: vac.batchNumber,
        administeredBy: vac.administeredBy,
        notes: vac.notes,
      })),

      thriposhaDistributions: m.thriposhaDistributions
        .filter((t) => t.recipientType === "PREGNANT_MOTHER" || t.recipientType === "LACTATING_MOTHER")
        .map((t) => ({
          distributionDate: t.distributionDate,
          month: t.month,
          year: t.year,
          packetType: String(t.packetType),
          quantity: Number(t.quantity),
          batchNumber: t.batchNumber,
          notes: t.notes,
        })),

      children: m.children.map((c) => ({
        name: c.name,
        gender: String(c.gender),
        birthDate: c.birthDate,
        birthWeight: c.birthWeight ? Number(c.birthWeight) : null,
        gestationalAgeWeeks: c.gestationalAgeWeeks,
        isPreterm: c.isPreterm,
        healthNotes: c.healthNotes,
      })),

      documents: m.documents.map((d) => ({
        fileName: d.fileName,
        documentTypeName: d.documentType.name,
        uploadedAt: d.uploadedAt,
      })),
    };
  });
}