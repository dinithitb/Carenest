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

    // Fetch vaccinations data
    const vaccinations = await prisma.vaccination.findMany({
      where: {
        OR: [
          {
            scheduledDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
          {
            administeredDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
        ],
      },
      include: {
        mother: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        child: {
          select: { name: true },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });

    // Calculate statistics
    const totalVaccinations = vaccinations.length;
    const completedVaccinations = vaccinations.filter((v) => v.status === 'COMPLETED').length;
    const pendingVaccinations = vaccinations.filter((v) => v.status === 'PENDING').length;
    const missedVaccinations = vaccinations.filter((v) => v.status === 'MISSED').length;
    const coverageRate = totalVaccinations > 0 ? Math.round((completedVaccinations / totalVaccinations) * 100) : 0;

    // Vaccinations by type
    const vaccinationTypes = vaccinations.reduce((acc, v) => {
      acc[v.vaccineName] = (acc[v.vaccineName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Vaccinations by recipient type
    const motherVaccinations = vaccinations.filter((v) => v.motherId && !v.childId).length;
    const childVaccinations = vaccinations.filter((v) => v.childId).length;

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'Vaccinations Report',
      subtitle: 'Immunization Coverage Analysis',
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
      { label: 'Total Vaccinations', value: totalVaccinations, color: '#14B8A6' },
      { label: 'Completed', value: completedVaccinations, color: '#10B981' },
      { label: 'Pending', value: pendingVaccinations, color: '#F59E0B' },
      { label: 'Coverage Rate', value: `${coverageRate}%`, color: '#3B82F6' },
    ]);

    pdf.addSpace(10);

    // Recipient Distribution
    pdf.addSectionTitle('Vaccination Distribution');
    pdf.addTable({
      title: 'By Recipient Type',
      headers: ['Recipient Type', 'Count', 'Percentage'],
      rows: [
        ['Mothers', motherVaccinations.toString(), `${Math.round((motherVaccinations / totalVaccinations) * 100)}%`],
        ['Children', childVaccinations.toString(), `${Math.round((childVaccinations / totalVaccinations) * 100)}%`],
      ],
    });

    pdf.addSpace(10);

    // Vaccine Type Distribution
    pdf.addSectionTitle('Vaccination Types');
    const vaccineTypeRows = Object.entries(vaccinationTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vaccine, count]) => [
        vaccine,
        count.toString(),
        `${Math.round((count / totalVaccinations) * 100)}%`,
      ]);
    
    pdf.addTable({
      title: 'Top 10 Vaccines Administered',
      headers: ['Vaccine Name', 'Count', 'Percentage'],
      rows: vaccineTypeRows,
    });

    pdf.addSpace(10);

    // Status Breakdown
    pdf.addSectionTitle('Status Overview');
    pdf.addTable({
      title: 'Vaccination Status',
      headers: ['Status', 'Count', 'Percentage'],
      rows: [
        ['Completed', completedVaccinations.toString(), `${Math.round((completedVaccinations / totalVaccinations) * 100)}%`],
        ['Pending', pendingVaccinations.toString(), `${Math.round((pendingVaccinations / totalVaccinations) * 100)}%`],
        ['Missed', missedVaccinations.toString(), `${Math.round((missedVaccinations / totalVaccinations) * 100)}%`],
      ],
    });

    pdf.addSpace(10);

    // Recent Vaccinations
    pdf.addSectionTitle('Recent Vaccinations');
    const recentVaccinationRows = vaccinations.slice(0, 25).map((vacc, index) => [
      (index + 1).toString(),
      vacc.vaccineName,
      vacc.mother?.user.name || vacc.child?.name || 'Unknown',
      vacc.childId ? 'Child' : 'Mother',
      new Date(vacc.scheduledDate).toLocaleDateString(),
      vacc.status,
      vacc.administeredBy || 'Unassigned',
    ]);

    pdf.addTable({
      headers: ['#', 'Vaccine', 'Recipient', 'Type', 'Date', 'Status', 'Midwife'],
      rows: recentVaccinationRows,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 30 },
      },
    });

    if (vaccinations.length > 25) {
      pdf.addParagraph(
        `Note: Showing 25 most recent vaccinations. Total: ${vaccinations.length} vaccinations in this period.`,
        9
      );
    }

    // Summary Section
    pdf.addSpace(10);
    pdf.addSectionTitle('Summary & Insights');
    pdf.addParagraph(
      `During ${dateRangeText}, ${totalVaccinations} vaccinations were scheduled or administered. ` +
      `${completedVaccinations} vaccinations (${coverageRate}%) were successfully completed, demonstrating strong immunization coverage. ` +
      `${pendingVaccinations} vaccinations are currently pending. ` +
      `${missedVaccinations > 0 ? `Attention required: ${missedVaccinations} vaccinations were missed and may need rescheduling.` : 'No vaccinations were missed during this period.'} ` +
      `The most administered vaccine was ${Object.entries(vaccinationTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'}.`
    );

    // Add footer
    pdf.addFooter(session.user.name || 'Admin User');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vaccinations-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating vaccinations report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
