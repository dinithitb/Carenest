import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'MOTHER' || !session.user.motherId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'all', startDate, endDate } = body;

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Fetch mother info
    const mother = await prisma.mother.findUnique({
      where: { id: session.user.motherId },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    // Fetch all visits
    const visits = await prisma.visit.findMany({
      where: {
        motherId: session.user.motherId,
        visitDate: {
          gte: dateFilter.startDate,
          lte: dateFilter.endDate,
        },
      },
      include: {
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

    // Fetch upcoming appointments
    const upcomingVisits = await prisma.visit.findMany({
      where: {
        motherId: session.user.motherId,
        visitDate: {
          gte: new Date(),
        },
        status: 'SCHEDULED',
      },
      include: {
        midwife: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        visitDate: 'asc',
      },
    });

    // Calculate statistics
    const totalVisits = visits.length;
    const completedVisits = visits.filter((v) => v.status === 'COMPLETED').length;
    const cancelledVisits = visits.filter((v) => v.status === 'CANCELLED').length;
    const attendanceRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    // Visit type distribution
    const visitTypes = visits.reduce((acc, v) => {
      acc[v.visitType] = (acc[v.visitType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'My Appointments',
      subtitle: 'Visit Schedule & History',
      dateRange: dateRangeText,
      generatedBy: mother?.user.name || 'Mother',
    });

    // Statistics Cards
    pdf.addStatCards([
      { label: 'Total Visits', value: totalVisits, color: '#14B8A6' },
      { label: 'Attended', value: completedVisits, color: '#10B981' },
      { label: 'Upcoming', value: upcomingVisits.length, color: '#3B82F6' },
      { label: 'Attendance Rate', value: `${attendanceRate}%`, color: '#EC4899' },
    ]);

    pdf.addSpace(10);

    // Upcoming Appointments
    if (upcomingVisits.length > 0) {
      pdf.addSectionTitle('Upcoming Appointments');
      const upcomingRows = upcomingVisits.map((visit, index) => [
        (index + 1).toString(),
        new Date(visit.visitDate).toLocaleDateString(),
        new Date(visit.visitDate).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        visit.visitType,
        visit.midwife?.user.name || 'To be assigned',
        'Clinic',
      ]);

      pdf.addTable({
        title: 'Please attend all scheduled appointments',
        headers: ['#', 'Date', 'Time', 'Type', 'Midwife', 'Location'],
        rows: upcomingRows,
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 },
        },
      });

      pdf.addSpace(10);
    } else {
      pdf.addSectionTitle('Upcoming Appointments');
      pdf.addParagraph('No upcoming appointments scheduled. Please contact your midwife if you need to schedule a visit.', 10);
      pdf.addSpace(10);
    }

    // Visit Type Summary
    if (Object.keys(visitTypes).length > 0) {
      pdf.addSectionTitle('Visit Type Summary');
      const visitTypeRows = Object.entries(visitTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => [
          type,
          count.toString(),
          `${Math.round((count / totalVisits) * 100)}%`,
        ]);
      
      pdf.addTable({
        headers: ['Visit Type', 'Count', 'Percentage'],
        rows: visitTypeRows,
      });

      pdf.addSpace(10);
    }

    // Past Appointments History
    pdf.addSectionTitle('Past Appointments');
    const completedVisitsList = visits.filter((v) => v.status === 'COMPLETED').slice(0, 25);
    
    if (completedVisitsList.length > 0) {
      const pastVisitRows = completedVisitsList.map((visit, index) => [
        (index + 1).toString(),
        new Date(visit.visitDate).toLocaleDateString(),
        visit.visitType,
        visit.midwife?.user.name || 'Unknown',
        visit.weight ? `${visit.weight} kg` : 'N/A',
        visit.bloodPressure || 'N/A',
        visit.notes ? '✓' : '-',
      ]);

      pdf.addTable({
        headers: ['#', 'Date', 'Type', 'Midwife', 'Weight', 'BP', 'Notes'],
        rows: pastVisitRows,
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

      if (visits.filter((v) => v.status === 'COMPLETED').length > 25) {
        pdf.addParagraph(
          `Note: Showing 25 most recent visits. Total completed visits: ${visits.filter((v) => v.status === 'COMPLETED').length}`,
          9
        );
      }
    } else {
      pdf.addParagraph('No completed visits recorded during this period.', 10);
    }

    pdf.addSpace(10);

    // Cancelled/Missed Appointments
    if (cancelledVisits > 0) {
      pdf.addSectionTitle('Cancelled Appointments');
      const cancelledList = visits
        .filter((v) => v.status === 'CANCELLED')
        .slice(0, 10)
        .map((visit, index) => [
          (index + 1).toString(),
          new Date(visit.visitDate).toLocaleDateString(),
          visit.visitType,
          visit.notes || 'No reason provided',
        ]);

      pdf.addTable({
        headers: ['#', 'Date', 'Type', 'Reason'],
        rows: cancelledList,
      });

      pdf.addSpace(10);
    }

    // Summary
    pdf.addSectionTitle('Appointment Summary');
    pdf.addParagraph(
      `This report shows your appointment history for ${dateRangeText}. ` +
      `You have attended ${completedVisits} out of ${totalVisits} scheduled appointments, achieving an ${attendanceRate}% attendance rate. ` +
      `${upcomingVisits.length > 0 ? `You have ${upcomingVisits.length} upcoming appointment(s) scheduled.` : 'No upcoming appointments are currently scheduled.'} ` +
      `${cancelledVisits > 0 ? `${cancelledVisits} appointment(s) were cancelled during this period.` : 'All scheduled appointments were either completed or are still pending.'} ` +
      `Regular attendance at prenatal appointments is crucial for a healthy pregnancy.`
    );

    // Important Notes
    pdf.addSpace(10);
    pdf.addSectionTitle('Important Information');
    const notes = [
      '• Attend all scheduled prenatal appointments for the best pregnancy outcome',
      '• If you need to cancel or reschedule, please contact your midwife at least 24 hours in advance',
      '• Bring your clinic card and any test results to each appointment',
      '• Arrive 10-15 minutes early to complete any necessary paperwork',
      '• Contact your midwife immediately if you experience any concerning symptoms between appointments',
    ];

    if (upcomingVisits.length > 0) {
      const nextVisit = upcomingVisits[0];
      notes.unshift(
        `• Next appointment: ${new Date(nextVisit.visitDate).toLocaleDateString()} at ${new Date(nextVisit.visitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      );
    }

    notes.forEach((note) => {
      pdf.addParagraph(note, 10);
    });

    // Add footer
    pdf.addFooter(mother?.user.name || 'Mother');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="my-appointments-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating mother appointments report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
