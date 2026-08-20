import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'MIDWIFE' || !session.user.midwifeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'month', startDate, endDate } = body;

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Get midwife info
    const midwife = await prisma.midwife.findUnique({
      where: { id: session.user.midwifeId },
      include: {
        user: {
          select: { name: true, email: true, phone: true, createdAt: true },
        },
      },
    });

    // Fetch comprehensive activity data
    const [
      totalAssignedMothers,
      activePregnancies,
      highRiskCases,
      visits,
      vaccinations,
      documents,
    ] = await Promise.all([
      prisma.mother.count({
        where: { assignedMidwifeId: session.user.midwifeId },
      }),
      prisma.pregnancy.count({
        where: {
          mother: { assignedMidwifeId: session.user.midwifeId },
          status: 'ACTIVE',
        },
      }),
      prisma.pregnancy.count({
        where: {
          mother: { assignedMidwifeId: session.user.midwifeId },
          status: 'ACTIVE',
          highRisk: true,
        },
      }),
      prisma.visit.findMany({
        where: {
          mother: { assignedMidwifeId: session.user.midwifeId },
          visitDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
        select: {
          status: true,
          visitType: true,
          visitDate: true,
        },
      }),
      prisma.vaccination.findMany({
        where: {
          mother: { assignedMidwifeId: session.user.midwifeId },
          scheduledDate: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
        select: {
          status: true,
          vaccineName: true,
        },
      }),
      prisma.document.count({
        where: {
          mother: { assignedMidwifeId: session.user.midwifeId },
          uploadedAt: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),
    ]);

    // Calculate visit statistics
    const totalVisits = visits.length;
    const completedVisits = visits.filter((v) => v.status === 'COMPLETED').length;
    const pendingVisits = visits.filter((v) => v.status === 'SCHEDULED').length;
    const visitCompletionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    // Calculate vaccination statistics
    const totalVaccinations = vaccinations.length;
    const completedVaccinations = vaccinations.filter((v) => v.status === 'COMPLETED').length;
    const vaccinationRate = totalVaccinations > 0 ? Math.round((completedVaccinations / totalVaccinations) * 100) : 0;

    // Visit type distribution
    const visitTypes = visits.reduce((acc, v) => {
      acc[v.visitType] = (acc[v.visitType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Weekly activity (last 4 weeks)
    const weeksActivity = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(dateFilter.endDate);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekVisits = visits.filter((v) => {
        const vDate = new Date(v.visitDate);
        return vDate >= weekStart && vDate < weekEnd && v.status === 'COMPLETED';
      }).length;

      weeksActivity.push({
        week: `Week ${4 - i}`,
        visits: weekVisits,
      });
    }

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'My Activity Summary',
      subtitle: 'Professional Performance Report',
      dateRange: dateRangeText,
      generatedBy: session.user.name || 'Midwife',
      clinicInfo: {
        name: midwife?.user.name || 'Healthcare Provider',
        address: 'Member since ' + new Date(midwife?.user.createdAt || new Date()).toLocaleDateString(),
        phone: midwife?.user.email || '',
      },
    });

    // Statistics Cards
    pdf.addStatCards([
      { label: 'Assigned Mothers', value: totalAssignedMothers, color: '#14B8A6' },
      { label: 'Active Pregnancies', value: activePregnancies, color: '#3B82F6' },
      { label: 'Visits Conducted', value: completedVisits, color: '#10B981' },
      { label: 'High Risk Cases', value: highRiskCases, color: '#EF4444' },
    ]);

    pdf.addSpace(10);

    // Performance Metrics
    pdf.addSectionTitle('Performance Metrics');
    pdf.addTable({
      title: `Period: ${dateRangeText}`,
      headers: ['Metric', 'Count', 'Rate/Details'],
      rows: [
        ['Total Visits Scheduled', totalVisits.toString(), `${visitCompletionRate}% completion`],
        ['Completed Visits', completedVisits.toString(), `${totalVisits - completedVisits} pending`],
        ['Vaccinations Administered', completedVaccinations.toString(), `${vaccinationRate}% coverage`],
        ['Documents Uploaded', documents.toString(), 'Patient records'],
        ['High Risk Cases Managed', highRiskCases.toString(), 'Special attention required'],
      ],
    });

    pdf.addSpace(10);

    // Visit Type Breakdown
    if (Object.keys(visitTypes).length > 0) {
      pdf.addSectionTitle('Visit Type Distribution');
      const visitTypeRows = Object.entries(visitTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => [
          type,
          count.toString(),
          `${Math.round((count / totalVisits) * 100)}%`,
        ]);
      
      pdf.addTable({
        title: 'Types of Visits Conducted',
        headers: ['Visit Type', 'Count', 'Percentage'],
        rows: visitTypeRows,
      });

      pdf.addSpace(10);
    }

    // Weekly Activity Trend
    if (range === 'month' || range === 'quarter') {
      pdf.addSectionTitle('Weekly Activity Trend');
      const weeklyRows = weeksActivity.map((week) => [
        week.week,
        week.visits.toString(),
        week.visits > 10 ? 'High' : week.visits > 5 ? 'Moderate' : 'Low',
      ]);
      
      pdf.addTable({
        title: 'Completed Visits by Week',
        headers: ['Period', 'Visits Completed', 'Activity Level'],
        rows: weeklyRows,
      });

      pdf.addSpace(10);
    }

    // Caseload Overview
    pdf.addSectionTitle('Current Caseload');
    pdf.addTable({
      headers: ['Category', 'Count'],
      rows: [
        ['Total Assigned Mothers', totalAssignedMothers.toString()],
        ['Active Pregnancies', activePregnancies.toString()],
        ['High Risk Cases', highRiskCases.toString()],
        ['Normal Risk Cases', (activePregnancies - highRiskCases).toString()],
      ],
    });

    pdf.addSpace(10);

    // Professional Summary
    pdf.addSectionTitle('Professional Summary');
    pdf.addParagraph(
      `During ${dateRangeText}, you demonstrated strong professional performance in maternal care delivery. ` +
      `You are currently responsible for ${totalAssignedMothers} mothers, with ${activePregnancies} active pregnancies under your care. ` +
      `You successfully completed ${completedVisits} visits (${visitCompletionRate}% completion rate) and administered ${completedVaccinations} vaccinations (${vaccinationRate}% coverage). ` +
      `${highRiskCases} high-risk pregnancy cases are being managed with special attention. ` +
      `You uploaded ${documents} medical documents during this period, maintaining comprehensive patient records. ` +
      `Your average weekly activity shows ${(completedVisits / 4).toFixed(1)} completed visits per week.`
    );

    // Strengths and Achievements
    pdf.addSpace(10);
    pdf.addSectionTitle('Achievements & Strengths');
    const strengths = [];
    
    if (visitCompletionRate >= 85) {
      strengths.push(`✓ Excellent visit completion rate (${visitCompletionRate}%) - exceeds target`);
    }
    if (vaccinationRate >= 90) {
      strengths.push(`✓ Outstanding vaccination coverage (${vaccinationRate}%) - exceeds target`);
    }
    if (completedVisits > 20) {
      strengths.push(`✓ High productivity with ${completedVisits} visits completed this period`);
    }
    if (documents > 15) {
      strengths.push(`✓ Excellent documentation practices with ${documents} records uploaded`);
    }
    if (totalAssignedMothers > 0 && highRiskCases / totalAssignedMothers < 0.2) {
      strengths.push('✓ Effective preventive care resulting in low high-risk pregnancy rate');
    }
    if (strengths.length === 0) {
      strengths.push('✓ Consistent performance in maternal care delivery');
    }

    strengths.forEach((strength) => {
      pdf.addParagraph(strength, 10);
    });

    // Areas for Focus
    pdf.addSpace(10);
    pdf.addSectionTitle('Focus Areas');
    const focus = [];
    
    if (visitCompletionRate < 75) {
      focus.push(`• Improve visit completion rate (currently ${visitCompletionRate}%, target 85%)`);
    }
    if (pendingVisits > 5) {
      focus.push(`• Follow up on ${pendingVisits} pending visits`);
    }
    if (vaccinationRate < 85) {
      focus.push(`• Increase vaccination coverage (currently ${vaccinationRate}%, target 90%)`);
    }
    if (highRiskCases > 0) {
      focus.push(`• Continue enhanced monitoring for ${highRiskCases} high-risk cases`);
    }
    if (focus.length === 0) {
      focus.push('• Maintain current standards of care');
      focus.push('• Consider knowledge sharing with junior colleagues');
    }

    focus.forEach((item) => {
      pdf.addParagraph(item, 10);
    });

    // Add footer
    pdf.addFooter(session.user.name || 'Midwife User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="my-activity-summary-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating midwife summary report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
