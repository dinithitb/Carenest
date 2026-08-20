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

    // Fetch visits data
    const visits = await prisma.visit.findMany({
      where: {
        visitDate: {
          gte: dateFilter.startDate,
          lte: dateFilter.endDate,
        },
      },
      include: {
        mother: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        midwife: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        visitDate: 'desc',
      },
    });

    // Calculate statistics
    const totalVisits = visits.length;
    const completedVisits = visits.filter((v) => v.status === 'COMPLETED').length;
    const pendingVisits = visits.filter((v) => v.status === 'SCHEDULED').length;
    const cancelledVisits = visits.filter((v) => v.status === 'CANCELLED').length;
    const completionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    // Visit type distribution
    const visitTypes = visits.reduce((acc, v) => {
      acc[v.visitType] = (acc[v.visitType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Visits by midwife
    const visitsByMidwife = visits.reduce((acc, v) => {
      const midwifeName = v.midwife?.user.name || 'Unassigned';
      acc[midwifeName] = (acc[midwifeName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'Visits Report',
      subtitle: 'Visit Schedule & Analysis',
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
      { label: 'Total Visits', value: totalVisits, color: '#14B8A6' },
      { label: 'Completed', value: completedVisits, color: '#10B981' },
      { label: 'Pending', value: pendingVisits, color: '#F59E0B' },
      { label: 'Completion Rate', value: `${completionRate}%`, color: '#3B82F6' },
    ]);

    pdf.addSpace(10);

    // Visit Type Distribution
    pdf.addSectionTitle('Visit Type Distribution');
    const visitTypeRows = Object.entries(visitTypes).map(([type, count]) => [
      type,
      count.toString(),
      `${Math.round((count / totalVisits) * 100)}%`,
    ]);
    
    pdf.addTable({
      title: 'Visits by Type',
      headers: ['Visit Type', 'Count', 'Percentage'],
      rows: visitTypeRows,
    });

    pdf.addSpace(10);

    // Visits by Midwife
    pdf.addSectionTitle('Visits by Midwife');
    const midwifeRows = Object.entries(visitsByMidwife)
      .sort((a, b) => b[1] - a[1])
      .map(([midwife, count]) => [
        midwife,
        count.toString(),
        `${Math.round((count / totalVisits) * 100)}%`,
      ]);
    
    pdf.addTable({
      title: 'Performance by Healthcare Provider',
      headers: ['Midwife', 'Visits Conducted', 'Share'],
      rows: midwifeRows,
    });

    pdf.addSpace(10);

    // Recent Visits
    pdf.addSectionTitle('Recent Visits');
    const recentVisitRows = visits.slice(0, 30).map((visit, index) => [
      (index + 1).toString(),
      new Date(visit.visitDate).toLocaleDateString(),
      visit.mother?.user.name || 'Unknown',
      visit.visitType,
      visit.status,
      visit.midwife?.user.name || 'Unassigned',
      visit.notes ? 'Yes' : 'No',
    ]);

    pdf.addTable({
      headers: ['#', 'Date', 'Mother', 'Type', 'Status', 'Midwife', 'Notes'],
      rows: recentVisitRows,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30 },
        6: { cellWidth: 15 },
      },
    });

    if (visits.length > 30) {
      pdf.addParagraph(
        `Note: Showing 30 most recent visits. Total: ${visits.length} visits in this period.`,
        9
      );
    }

    // Summary Section
    pdf.addSpace(10);
    pdf.addSectionTitle('Summary & Insights');
    pdf.addParagraph(
      `During the period ${dateRangeText}, a total of ${totalVisits} visits were recorded in the system. ` +
      `${completedVisits} visits (${completionRate}%) were successfully completed, while ${pendingVisits} visits are still pending. ` +
      `The most common visit type was ${Object.entries(visitTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'}. ` +
      `${cancelledVisits > 0 ? `${cancelledVisits} visits were cancelled during this period.` : 'No visits were cancelled.'}`
    );

    // Add footer
    pdf.addFooter(session.user.name || 'Admin User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="visits-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating visits report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
