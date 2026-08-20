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

    // Fetch visits data for assigned mothers
    const visits = await prisma.visit.findMany({
      where: {
        mother: {
          assignedMidwifeId: session.user.midwifeId,
        },
        visitDate: {
          gte: dateFilter.startDate,
          lte: dateFilter.endDate,
        },
      },
      include: {
        mother: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
      },
      orderBy: {
        visitDate: 'desc',
      },
    });

    // Get upcoming visits (future dates)
    const upcomingVisits = await prisma.visit.findMany({
      where: {
        mother: {
          assignedMidwifeId: session.user.midwifeId,
        },
        visitDate: {
          gte: new Date(),
        },
        status: 'SCHEDULED',
      },
      include: {
        mother: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
      },
      orderBy: {
        visitDate: 'asc',
      },
      take: 20,
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

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'My Visits Report',
      subtitle: 'Patient Visit Schedule & History',
      dateRange: dateRangeText,
      generatedBy: session.user.name || 'Midwife',
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
        title: 'Visits by Type',
        headers: ['Visit Type', 'Count', 'Percentage'],
        rows: visitTypeRows,
      });

      pdf.addSpace(10);
    }

    // Upcoming Visits Schedule
    if (upcomingVisits.length > 0) {
      pdf.addSectionTitle('Upcoming Visits Schedule');
      const upcomingRows = upcomingVisits.map((visit, index) => [
        (index + 1).toString(),
        new Date(visit.visitDate).toLocaleDateString(),
        new Date(visit.visitDate).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        visit.mother?.user.name || 'Unknown',
        visit.mother?.user.phone || 'N/A',
        visit.visitType,
      ]);

      pdf.addTable({
        title: 'Next 20 Scheduled Visits',
        headers: ['#', 'Date', 'Time', 'Mother', 'Phone', 'Type'],
        rows: upcomingRows,
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 40 },
          4: { cellWidth: 30 },
          5: { cellWidth: 35 },
        },
      });

      pdf.addSpace(10);
    }

    // Recent Completed Visits
    pdf.addSectionTitle('Recent Visit History');
    const recentVisitRows = visits
      .filter((v) => v.status === 'COMPLETED')
      .slice(0, 30)
      .map((visit, index) => [
        (index + 1).toString(),
        new Date(visit.visitDate).toLocaleDateString(),
        visit.mother?.user.name || 'Unknown',
        visit.visitType,
        visit.weight ? `${visit.weight} kg` : 'N/A',
        visit.bloodPressure || 'N/A',
        visit.notes ? 'Yes' : 'No',
      ]);

    if (recentVisitRows.length > 0) {
      pdf.addTable({
        headers: ['#', 'Date', 'Mother', 'Type', 'Weight', 'BP', 'Notes'],
        rows: recentVisitRows,
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 },
          6: { cellWidth: 15 },
        },
      });
    } else {
      pdf.addParagraph('No completed visits in this period.', 10);
    }

    pdf.addSpace(10);

    // Performance Summary
    pdf.addSectionTitle('Performance Summary');
    pdf.addParagraph(
      `During the period ${dateRangeText}, you conducted ${totalVisits} patient visits for your assigned mothers. ` +
      `${completedVisits} visits (${completionRate}%) were successfully completed, demonstrating strong patient care delivery. ` +
      `${pendingVisits} visits remain pending, and ${cancelledVisits} visits were cancelled during this period. ` +
      `The most common visit type was ${Object.entries(visitTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'}. ` +
      `You have ${upcomingVisits.length} upcoming visits scheduled with your assigned mothers.`
    );

    // Actionable Insights
    pdf.addSpace(10);
    pdf.addSectionTitle('Action Items');
    const actions = [];
    
    if (upcomingVisits.length > 0) {
      const nextVisit = upcomingVisits[0];
      const nextVisitDate = new Date(nextVisit.visitDate).toLocaleDateString();
      actions.push(`• Next visit: ${nextVisit.mother?.user.name} on ${nextVisitDate}`);
    }
    
    if (pendingVisits > 0) {
      actions.push(`• Follow up on ${pendingVisits} pending visits`);
    }
    
    if (cancelledVisits > 0) {
      actions.push(`• Review ${cancelledVisits} cancelled visits and reschedule if needed`);
    }
    
    if (upcomingVisits.length > 5) {
      actions.push(`• Prepare for ${upcomingVisits.length} upcoming appointments`);
    }
    
    actions.push('• Send appointment reminders to mothers 24-48 hours in advance');
    actions.push('• Review and update patient notes for completed visits');
    
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
        'Content-Disposition': `attachment; filename="my-visits-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating midwife visits report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
