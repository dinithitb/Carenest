import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'month', startDate, endDate } = body;

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Fetch comprehensive data
    const [
      totalMothers,
      activeMothers,
      totalMidwives,
      totalVisits,
      completedVisits,
      totalVaccinations,
      completedVaccinations,
      totalChildren,
      highRiskPregnancies,
      documents
    ] = await Promise.all([
      prisma.mother.count(),
      prisma.mother.count({ where: { user: { isActive: true } } }),
      prisma.midwife.count({ where: { user: { isActive: true } } }),
      prisma.visit.count({
        where: {
          visitDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),
      prisma.visit.count({
        where: {
          visitDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
          status: 'COMPLETED',
        },
      }),
      prisma.vaccination.count({
        where: {
          scheduledDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),
      prisma.vaccination.count({
        where: {
          scheduledDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
          status: 'COMPLETED',
        },
      }),
      prisma.child.count(),
      prisma.pregnancy.count({
        where: {
          status: 'ACTIVE',
          highRisk: true,
        },
      }),
      prisma.document.count({
        where: {
          uploadedAt: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),
    ]);

    // Calculate rates
    const visitCompletionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
    const vaccinationCoverageRate = totalVaccinations > 0 ? Math.round((completedVaccinations / totalVaccinations) * 100) : 0;
    const midwifeWorkload = totalMidwives > 0 ? Math.round(activeMothers / totalMidwives) : 0;

    // Recent activity - mothers registered
    const recentMothers = await prisma.mother.findMany({
      where: {
        user: {
          createdAt: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      },
      include: {
        user: {
          select: { name: true, createdAt: true },
        },
        assignedMidwife: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: {
        user: { createdAt: 'desc' },
      },
      take: 15,
    });

    // System health indicators
    const unassignedMothers = await prisma.mother.count({
      where: { assignedMidwifeId: null },
    });

    const missedVisits = await prisma.visit.count({
      where: {
        visitDate: {
          lt: new Date(),
        },
        status: 'SCHEDULED',
      },
    });

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'System Summary Report',
      subtitle: 'Comprehensive Overview',
      dateRange: dateRangeText,
      generatedBy: session.user.name || 'Admin',
      clinicInfo: {
        name: 'CareNest Health Center',
        address: 'Maternal Care Division',
        phone: 'Contact: +94 XX XXX XXXX',
      },
    });

    // Key Statistics
    pdf.addStatCards([
      { label: 'Total Mothers', value: totalMothers, color: '#14B8A6' },
      { label: 'Active Midwives', value: totalMidwives, color: '#3B82F6' },
      { label: 'Children', value: totalChildren, color: '#EC4899' },
      { label: 'High Risk Cases', value: highRiskPregnancies, color: '#EF4444' },
    ]);

    pdf.addSpace(10);

    // Performance Metrics
    pdf.addSectionTitle('Performance Metrics');
    pdf.addTable({
      title: `Period: ${dateRangeText}`,
      headers: ['Metric', 'Value', 'Rate/Status'],
      rows: [
        ['Total Visits', totalVisits.toString(), `${visitCompletionRate}% completed`],
        ['Completed Visits', completedVisits.toString(), `${totalVisits - completedVisits} pending`],
        ['Total Vaccinations', totalVaccinations.toString(), `${vaccinationCoverageRate}% coverage`],
        ['Completed Vaccinations', completedVaccinations.toString(), `${totalVaccinations - completedVaccinations} pending`],
        ['Documents Uploaded', documents.toString(), 'Medical records'],
      ],
    });

    pdf.addSpace(10);

    // Workload Analysis
    pdf.addSectionTitle('Workforce Analysis');
    pdf.addTable({
      headers: ['Metric', 'Count', 'Notes'],
      rows: [
        ['Active Mothers', activeMothers.toString(), 'Currently enrolled'],
        ['Active Midwives', totalMidwives.toString(), 'Healthcare providers'],
        ['Average Workload', midwifeWorkload.toString(), 'Mothers per midwife'],
        ['Unassigned Mothers', unassignedMothers.toString(), 'Require assignment'],
      ],
    });

    pdf.addSpace(10);

    // System Health
    pdf.addSectionTitle('System Health Indicators');
    
    const alerts = [];
    if (unassignedMothers > 0) {
      alerts.push(`⚠ ${unassignedMothers} mothers are not assigned to a midwife`);
    }
    if (missedVisits > 0) {
      alerts.push(`⚠ ${missedVisits} visits are overdue and need rescheduling`);
    }
    if (highRiskPregnancies > 0) {
      alerts.push(`⚠ ${highRiskPregnancies} high-risk pregnancies require special attention`);
    }
    if (visitCompletionRate < 80) {
      alerts.push(`⚠ Visit completion rate (${visitCompletionRate}%) is below target (80%)`);
    }
    if (vaccinationCoverageRate < 90) {
      alerts.push(`⚠ Vaccination coverage (${vaccinationCoverageRate}%) is below target (90%)`);
    }
    if (alerts.length === 0) {
      alerts.push('✓ All systems operating normally');
    }

    alerts.forEach((alert) => {
      pdf.addParagraph(alert, 10);
    });

    pdf.addSpace(10);

    // Recent Registrations
    pdf.addSectionTitle('Recent Mother Registrations');
    const motherRows = recentMothers.map((mother, index) => [
      (index + 1).toString(),
      mother.user.name || 'N/A',
      new Date(mother.user.createdAt).toLocaleDateString(),
      mother.assignedMidwife?.user.name || 'Unassigned',
      mother.bloodGroup || 'N/A',
    ]);

    pdf.addTable({
      headers: ['#', 'Name', 'Registration Date', 'Assigned Midwife', 'Blood Group'],
      rows: motherRows,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25 },
      },
    });

    pdf.addSpace(10);

    // Executive Summary
    pdf.addSectionTitle('Executive Summary');
    pdf.addParagraph(
      `CareNest is currently managing ${totalMothers} mothers with ${totalMidwives} active midwives (average workload: ${midwifeWorkload} mothers per midwife). ` +
      `During ${dateRangeText}, ${totalVisits} visits were scheduled with a completion rate of ${visitCompletionRate}%. ` +
      `${totalVaccinations} vaccinations were administered with ${vaccinationCoverageRate}% coverage. ` +
      `${highRiskPregnancies} pregnancies are classified as high-risk and require enhanced monitoring. ` +
      `${unassignedMothers > 0 ? `Action required: ${unassignedMothers} mothers need to be assigned to midwives.` : 'All mothers have been assigned to midwives.'} ` +
      `The system has processed ${documents} document uploads during this period, maintaining comprehensive health records.`
    );

    // Recommendations
    pdf.addSpace(10);
    pdf.addSectionTitle('Recommendations');
    const recommendations = [];
    
    if (unassignedMothers > 0) {
      recommendations.push('• Prioritize assignment of unassigned mothers to available midwives');
    }
    if (missedVisits > 0) {
      recommendations.push('• Contact patients with missed visits to reschedule appointments');
    }
    if (visitCompletionRate < 80) {
      recommendations.push('• Investigate reasons for visit cancellations and implement reminder systems');
    }
    if (vaccinationCoverageRate < 90) {
      recommendations.push('• Increase vaccination awareness and schedule catch-up sessions');
    }
    if (midwifeWorkload > 30) {
      recommendations.push('• Consider hiring additional midwives to reduce workload per provider');
    }
    if (recommendations.length === 0) {
      recommendations.push('• Continue maintaining current service quality standards');
      recommendations.push('• Consider expanding services to reach more beneficiaries');
    }

    recommendations.forEach((rec) => {
      pdf.addParagraph(rec, 10);
    });

    // Add footer
    pdf.addFooter(session.user.name || 'Admin User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="system-summary-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating summary report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
