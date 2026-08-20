import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    console.log('[Admin Reports] Session:', {
      hasSession: !!session,
      role: session?.user?.role,
      userId: session?.user?.id
    });

    if (!session || session.user.role !== 'ADMIN') {
      console.error('[Admin Reports] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'month', startDate, endDate } = body;

    console.log('[Admin Reports - Mothers] Generating report:', { range, startDate, endDate });

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Fetch mothers data
    const mothers = await prisma.mother.findMany({
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
          select: {
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            isActive: true,
          },
        },
        assignedMidwife: {
          include: {
            user: {
              select: { name: true },
            },
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
      },
      orderBy: {
        user: { createdAt: 'desc' },
      },
    });

    // Calculate statistics
    const totalMothers = mothers.length;
    const assignedMothers = mothers.filter((m) => m.assignedMidwifeId).length;
    const activeMothers = mothers.filter((m) => m.user.isActive).length;
    const highRiskMothers = mothers.filter((m) => 
      m.pregnancies.some((p) => p.highRisk)
    ).length;
    const assignmentRate = totalMothers > 0 ? Math.round((assignedMothers / totalMothers) * 100) : 0;

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
      title: 'Mothers Report',
      subtitle: 'Comprehensive Overview',
      dateRange: dateRangeText,
      generatedBy: session.user.name || 'Admin',
      clinicInfo: {
        name: 'CareNest Health Center',
        address: 'Maternal Care Division',
        phone: 'Contact: +94 XX XXX XXXX',
      },
    });

    // Statistics Cards
    pdf.addStatCards([
      { label: 'Total Mothers', value: totalMothers, color: '#14B8A6' },
      { label: 'Active', value: activeMothers, color: '#10B981' },
      { label: 'Assigned', value: `${assignmentRate}%`, color: '#3B82F6' },
      { label: 'High Risk', value: highRiskMothers, color: '#EF4444' },
    ]);

    pdf.addSpace(10);

    // Blood Group Distribution
    pdf.addSectionTitle('Blood Group Distribution');
    const bloodGroupRows = Object.entries(bloodGroups).map(([group, count]) => [
      group,
      count.toString(),
      `${Math.round((count / totalMothers) * 100)}%`,
    ]);
    
    pdf.addTable({
      title: 'Distribution by Blood Type',
      headers: ['Blood Group', 'Count', 'Percentage'],
      rows: bloodGroupRows,
    });

    pdf.addSpace(10);

    // Mothers List
    pdf.addSectionTitle('Mothers List');
    const motherRows = mothers.slice(0, 50).map((mother, index) => {
      const pregnancy = mother.pregnancies[0];
      return [
        (index + 1).toString(),
        mother.user.name || 'N/A',
        mother.user.email,
        mother.assignedMidwife?.user.name || 'Unassigned',
        pregnancy?.lastMenstrualPeriod ? new Date(pregnancy.lastMenstrualPeriod).toLocaleDateString() : 'N/A',
        pregnancy?.expectedDeliveryDate ? new Date(pregnancy.expectedDeliveryDate).toLocaleDateString() : 'N/A',
        pregnancy?.highRisk ? 'Yes' : 'No',
        mother.user.isActive ? 'Active' : 'Inactive',
      ];
    });

    pdf.addTable({
      headers: ['#', 'Name', 'Email', 'Midwife', 'LMP', 'EDD', 'High Risk', 'Status'],
      rows: motherRows,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
      },
    });

    if (mothers.length > 50) {
      pdf.addParagraph(
        `Note: Showing first 50 mothers. Total: ${mothers.length} mothers in this period.`,
        9
      );
    }

    // Summary Section
    pdf.addSpace(10);
    pdf.addSectionTitle('Summary & Insights');
    pdf.addParagraph(
      `This report covers ${totalMothers} mothers registered in the system during the period ${dateRangeText}. ` +
      `${assignmentRate}% of mothers have been assigned to midwives for personalized care. ` +
      `${highRiskMothers} mothers are classified as high-risk pregnancies requiring special attention. ` +
      `The most common blood group is ${Object.entries(bloodGroups).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'}.`
    );

    // Add footer
    pdf.addFooter(session.user.name || 'Admin User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mothers-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Admin Reports - Mothers] Error generating report:', error);
    console.error('[Admin Reports - Mothers] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
