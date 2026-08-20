import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    console.log('[Midwife Reports] Session:', {
      hasSession: !!session,
      role: session?.user?.role,
      userId: session?.user?.id,
      midwifeId: session?.user?.midwifeId
    });

    if (!session || session.user.role !== 'MIDWIFE' || !session.user.midwifeId) {
      console.error('[Midwife Reports] Unauthorized:', {
        hasSession: !!session,
        role: session?.user?.role,
        hasMidwifeId: !!session?.user?.midwifeId
      });
      return NextResponse.json({ 
        error: 'Unauthorized - Midwife access required',
        details: {
          hasSession: !!session,
          role: session?.user?.role,
          hasMidwifeId: !!session?.user?.midwifeId
        }
      }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'month', startDate, endDate } = body;

    console.log('[Midwife Reports - Mothers] Generating report:', { range, startDate, endDate, midwifeId: session.user.midwifeId });

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Fetch assigned mothers data
    const mothers = await prisma.mother.findMany({
      where: {
        assignedMidwifeId: session.user.midwifeId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            isActive: true,
          },
        },
        pregnancies: {
          where: { status: 'ACTIVE' },
          select: {
            lastMenstrualPeriod: true,
            expectedDeliveryDate: true,
            highRisk: true,
          },
        },
        visits: {
          where: {
            visitDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
          select: {
            visitDate: true,
            status: true,
            visitType: true,
          },
        },
        vaccinations: {
          where: {
            scheduledDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        user: { createdAt: 'desc' },
      },
    });

    // Get midwife info
    const midwife = await prisma.midwife.findUnique({
      where: { id: session.user.midwifeId },
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
      },
    });

    // Calculate statistics
    const totalMothers = mothers.length;
    const activeMothers = mothers.filter((m) => m.user.isActive).length;
    const highRiskMothers = mothers.filter((m) => 
      m.pregnancies.some((p) => p.highRisk)
    ).length;
    const totalVisits = mothers.reduce((sum, m) => sum + m.visits.length, 0);
    const completedVisits = mothers.reduce(
      (sum, m) => sum + m.visits.filter((v) => v.status === 'COMPLETED').length,
      0
    );
    const totalVaccinations = mothers.reduce((sum, m) => sum + m.vaccinations.length, 0);

    // Blood group distribution
    const bloodGroups = mothers.reduce((acc, m) => {
      const bg = m.bloodGroup || 'Unknown';
      acc[bg] = (acc[bg] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'My Assigned Mothers',
      subtitle: 'Patient Caseload Report',
      dateRange: `Activity: ${dateRangeText}`,
      generatedBy: session.user.name || 'Midwife',
      clinicInfo: {
        name: midwife?.user.name || 'Healthcare Provider',
        address: midwife?.user.email || '',
        phone: midwife?.user.phone || '',
      },
    });

    // Statistics Cards
    pdf.addStatCards([
      { label: 'Assigned Mothers', value: totalMothers, color: '#14B8A6' },
      { label: 'Active Cases', value: activeMothers, color: '#10B981' },
      { label: 'High Risk', value: highRiskMothers, color: '#EF4444' },
      { label: 'Visits (Period)', value: totalVisits, color: '#3B82F6' },
    ]);

    pdf.addSpace(10);

    // Activity Summary
    pdf.addSectionTitle('Activity Summary');
    pdf.addTable({
      title: `Period: ${dateRangeText}`,
      headers: ['Activity', 'Count', 'Notes'],
      rows: [
        ['Total Visits Conducted', totalVisits.toString(), `${completedVisits} completed`],
        ['Vaccinations Administered', totalVaccinations.toString(), 'Scheduled in period'],
        ['High Risk Cases', highRiskMothers.toString(), 'Require special attention'],
      ],
    });

    pdf.addSpace(10);

    // Blood Group Distribution
    if (Object.keys(bloodGroups).length > 0) {
      pdf.addSectionTitle('Blood Group Distribution');
      const bloodGroupRows = Object.entries(bloodGroups)
        .sort((a, b) => b[1] - a[1])
        .map(([group, count]) => [
          group,
          count.toString(),
          `${Math.round((count / totalMothers) * 100)}%`,
        ]);
      
      pdf.addTable({
        title: 'Among Assigned Mothers',
        headers: ['Blood Group', 'Count', 'Percentage'],
        rows: bloodGroupRows,
      });

      pdf.addSpace(10);
    }

    // Mothers Detailed List
    pdf.addSectionTitle('Assigned Mothers Details');
    const motherRows = mothers.map((mother, index) => {
      const pregnancy = mother.pregnancies[0];
      const visitsInPeriod = mother.visits.length;
      const completedInPeriod = mother.visits.filter((v) => v.status === 'COMPLETED').length;
      
      return [
        (index + 1).toString(),
        mother.user.name || 'N/A',
        mother.user.phone || 'N/A',
        pregnancy?.lastMenstrualPeriod ? new Date(pregnancy.lastMenstrualPeriod).toLocaleDateString() : 'N/A',
        pregnancy?.expectedDeliveryDate ? new Date(pregnancy.expectedDeliveryDate).toLocaleDateString() : 'N/A',
        pregnancy?.highRisk ? 'High Risk' : 'Normal',
        `${completedInPeriod}/${visitsInPeriod}`,
        mother.user.isActive ? 'Active' : 'Inactive',
      ];
    });

    pdf.addTable({
      headers: ['#', 'Name', 'Phone', 'LMP', 'EDD', 'Risk', 'Visits', 'Status'],
      rows: motherRows,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
      },
    });

    pdf.addSpace(10);

    // High Risk Cases Detail
    if (highRiskMothers > 0) {
      pdf.addSectionTitle('High Risk Cases - Special Attention Required');
      const highRiskRows = mothers
        .filter((m) => m.pregnancies.some((p) => p.highRisk))
        .map((mother, index) => {
          const pregnancy = mother.pregnancies[0];
          return [
            (index + 1).toString(),
            mother.user.name || 'N/A',
            mother.user.phone || 'N/A',
            pregnancy?.expectedDeliveryDate ? new Date(pregnancy.expectedDeliveryDate).toLocaleDateString() : 'N/A',
            `G${(pregnancy as any)?.gravidaNumber || 0}P${(pregnancy as any)?.parityNumber || 0}`,
          ];
        });

      pdf.addTable({
        headers: ['#', 'Name', 'Contact', 'Expected Due Date', 'Gravida/Parity'],
        rows: highRiskRows,
      });

      pdf.addSpace(10);
    }

    // Professional Summary
    pdf.addSectionTitle('Professional Summary');
    pdf.addParagraph(
      `As a midwife in the CareNest system, you are currently responsible for ${totalMothers} mothers. ` +
      `${highRiskMothers} of these cases are classified as high-risk pregnancies requiring enhanced monitoring and care. ` +
      `During the period ${dateRangeText}, you conducted ${totalVisits} visits with ${completedVisits} successfully completed. ` +
      `${totalVaccinations} vaccinations were scheduled or administered for your assigned mothers during this period. ` +
      `This report provides a comprehensive overview of your caseload to support care planning and patient management.`
    );

    // Next Steps
    pdf.addSpace(10);
    pdf.addSectionTitle('Recommended Actions');
    const actions = [];
    
    const pendingVisits = totalVisits - completedVisits;
    if (pendingVisits > 0) {
      actions.push(`• Follow up on ${pendingVisits} pending visits to ensure continuity of care`);
    }
    
    if (highRiskMothers > 0) {
      actions.push(`• Schedule regular monitoring for ${highRiskMothers} high-risk pregnancy cases`);
    }
    
    const inactiveMothers = totalMothers - activeMothers;
    if (inactiveMothers > 0) {
      actions.push(`• Contact ${inactiveMothers} inactive mothers to check on their status`);
    }
    
    actions.push('• Review upcoming appointments and send reminders to mothers');
    actions.push('• Update visit notes and health records for completed consultations');
    
    actions.forEach((action) => {
      pdf.addParagraph(action, 10);
    });

    // Add footer
    pdf.addFooter(session.user.name || 'Midwife User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="my-mothers-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Midwife Reports - Mothers] Error generating report:', error);
    console.error('[Midwife Reports - Mothers] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
