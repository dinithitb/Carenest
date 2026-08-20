import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PDFReportGenerator, formatDateRange, getDateRangeFilter } from '@/lib/reports/pdf-generator';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    console.log('[Mother Reports - Health] Session:', {
      hasSession: !!session,
      role: session?.user?.role,
      userId: session?.user?.id,
      motherId: session?.user?.motherId
    });

    if (!session || session.user.role !== 'MOTHER' || !session.user.motherId) {
      console.error('[Mother Reports - Health] Unauthorized:', {
        hasSession: !!session,
        role: session?.user?.role,
        hasMotherId: !!session?.user?.motherId
      });
      return NextResponse.json({ 
        error: 'Unauthorized - Mother access required',
        details: {
          hasSession: !!session,
          role: session?.user?.role,
          hasMotherId: !!session?.user?.motherId
        }
      }, { status: 401 });
    }

    const body = await req.json();
    const { range = 'all', startDate, endDate } = body;

    console.log('[Mother Reports - Health] Generating report:', { range, startDate, endDate, motherId: session.user.motherId });

    // Get date range for filtering
    const dateFilter = getDateRangeFilter(range, startDate, endDate);
    const dateRangeText = formatDateRange(range, startDate, endDate);

    // Fetch mother's comprehensive health data
    const mother = await prisma.mother.findUnique({
      where: { id: session.user.motherId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            createdAt: true,
          },
        },
        assignedMidwife: {
          include: {
            user: {
              select: { name: true, phone: true, email: true },
            },
          },
        },
        pregnancies: {
          where: { status: 'ACTIVE' },
          select: {
            lastMenstrualPeriod: true,
            expectedDeliveryDate: true,
            highRisk: true,
            medicalNotes: true,
          },
        },
        visits: {
          where: {
            visitDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
          orderBy: { visitDate: 'desc' },
        },
        vaccinations: {
          where: {
            scheduledDate: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          },
          orderBy: { scheduledDate: 'desc' },
        },
        children: {
          select: {
            name: true,
            gender: true,
            birthDate: true,
            birthWeight: true,
          },
        },
      },
    });

    if (!mother) {
      return NextResponse.json({ error: 'Mother profile not found' }, { status: 404 });
    }

    const pregnancy = mother.pregnancies[0];
    const completedVisits = mother.visits.filter((v) => v.status === 'COMPLETED');
    const upcomingVisits = mother.visits.filter((v) => v.status === 'SCHEDULED' && new Date(v.visitDate) >= new Date());
    const completedVaccinations = mother.vaccinations.filter((v) => v.status === 'COMPLETED');

    // Calculate pregnancy week if pregnant
    let pregnancyWeek = 0;
    let daysRemaining = 0;
    if (pregnancy?.lastMenstrualPeriod) {
      const lmpDate = new Date(pregnancy.lastMenstrualPeriod);
      const today = new Date();
      const daysSinceLMP = Math.floor((today.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
      pregnancyWeek = Math.floor(daysSinceLMP / 7);
      
      if (pregnancy.expectedDeliveryDate) {
        const eddDate = new Date(pregnancy.expectedDeliveryDate);
        daysRemaining = Math.floor((eddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Generate PDF
    const pdf = new PDFReportGenerator();

    // Header
    pdf.addHeader({
      title: 'My Health Report',
      subtitle: 'Personal Maternal Health Summary',
      dateRange: `Period: ${dateRangeText}`,
      generatedBy: mother.user.name || 'Mother',
      clinicInfo: {
        name: 'CareNest Health Center',
        address: 'Personal Health Record',
        phone: `Member since ${new Date(mother.user.createdAt).toLocaleDateString()}`,
      },
    });

    // Statistics Cards
    const statsCards: { label: string; value: string | number; color: string }[] = [
      { label: 'Completed Visits', value: completedVisits.length, color: '#14B8A6' },
      { label: 'Vaccinations', value: completedVaccinations.length, color: '#3B82F6' },
      { label: 'Children', value: mother.children.length, color: '#EC4899' },
    ];

    if (pregnancy) {
      statsCards.push({ 
        label: pregnancyWeek > 0 ? `Week ${pregnancyWeek}` : 'Pregnant', 
        value: daysRemaining > 0 ? `${daysRemaining}d` : 'Soon', 
        color: '#10B981' 
      });
    }

    pdf.addStatCards(statsCards);

    pdf.addSpace(10);

    // Personal Information
    pdf.addSectionTitle('Personal Information');
    pdf.addKeyValue('Full Name', mother.user.name || 'N/A');
    pdf.addKeyValue('Contact', mother.user.phone || 'N/A');
    pdf.addKeyValue('Email', mother.user.email || 'N/A');
    pdf.addKeyValue('Address', mother.user.address || 'N/A');
    pdf.addKeyValue('Blood Group', mother.bloodGroup || 'Not recorded');
    if (mother.height) {
      pdf.addKeyValue('Height', `${mother.height} cm`);
    }

    pdf.addSpace(5);
    pdf.addDivider();

    // Assigned Healthcare Provider
    if (mother.assignedMidwife) {
      pdf.addSectionTitle('My Healthcare Provider');
      pdf.addKeyValue('Midwife', mother.assignedMidwife.user.name || 'N/A');
      pdf.addKeyValue('Contact', mother.assignedMidwife.user.phone || 'N/A');
      pdf.addKeyValue('Email', mother.assignedMidwife.user.email || 'N/A');
      pdf.addSpace(5);
      pdf.addDivider();
    }

    // Current Pregnancy Information
    if (pregnancy) {
      pdf.addSectionTitle('Current Pregnancy Information');
      pdf.addKeyValue('Last Menstrual Period (LMP)', pregnancy.lastMenstrualPeriod ? new Date(pregnancy.lastMenstrualPeriod).toLocaleDateString() : 'N/A');
      pdf.addKeyValue('Expected Due Date (EDD)', pregnancy.expectedDeliveryDate ? new Date(pregnancy.expectedDeliveryDate).toLocaleDateString() : 'N/A');
      pdf.addKeyValue('Current Week', `Week ${pregnancyWeek} of pregnancy`);
      if (daysRemaining > 0) {
        pdf.addKeyValue('Days Remaining', `${daysRemaining} days until expected due date`);
      }
      pdf.addKeyValue('Gravida/Parity', `G${(pregnancy as any).gravidaNumber || 0}P${(pregnancy as any).parityNumber || 0}`);
      pdf.addKeyValue('Risk Level', pregnancy.highRisk ? 'High Risk - Extra care needed' : 'Normal Risk');
      if (pregnancy.medicalNotes) {
        pdf.addKeyValue('Notes', pregnancy.medicalNotes);
      }
      pdf.addSpace(5);
      pdf.addDivider();
    }

    // Children Information
    if (mother.children.length > 0) {
      pdf.addSectionTitle('My Children');
      const childrenRows = mother.children.map((child, index) => [
        (index + 1).toString(),
        child.name || 'N/A',
        child.gender || 'N/A',
        new Date(child.birthDate).toLocaleDateString(),
        child.birthWeight ? `${child.birthWeight} kg` : 'N/A',
      ]);

      pdf.addTable({
        headers: ['#', 'Name', 'Gender', 'Date of Birth', 'Birth Weight'],
        rows: childrenRows,
      });

      pdf.addSpace(10);
    }

    // Visit History
    pdf.addSectionTitle('My Visit History');
    if (completedVisits.length > 0) {
      const visitRows = completedVisits.slice(0, 15).map((visit, index) => [
        (index + 1).toString(),
        new Date(visit.visitDate).toLocaleDateString(),
        visit.visitType,
        visit.weight ? `${visit.weight} kg` : 'N/A',
        visit.bloodPressure || 'N/A',
        visit.notes ? '✓' : '-',
      ]);

      pdf.addTable({
        title: 'Recent Completed Visits',
        headers: ['#', 'Date', 'Type', 'Weight', 'Blood Pressure', 'Notes'],
        rows: visitRows,
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 15 },
        },
      });
    } else {
      pdf.addParagraph('No visits recorded during this period.', 10);
    }

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
      ]);

      pdf.addTable({
        headers: ['#', 'Date', 'Time', 'Type'],
        rows: upcomingRows,
      });

      pdf.addSpace(10);
    }

    // Vaccination History
    pdf.addSectionTitle('My Vaccination History');
    if (completedVaccinations.length > 0) {
      const vaccinationRows = completedVaccinations.slice(0, 10).map((vacc, index) => [
        (index + 1).toString(),
        vacc.vaccineName,
        new Date(vacc.administeredDate || vacc.scheduledDate).toLocaleDateString(),
        vacc.administeredBy || 'Healthcare Provider',
      ]);

      pdf.addTable({
        headers: ['#', 'Vaccine Name', 'Date Administered', 'Administered By'],
        rows: vaccinationRows,
      });
    } else {
      pdf.addParagraph('No vaccinations recorded during this period.', 10);
    }

    pdf.addSpace(10);

    // Health Summary
    pdf.addSectionTitle('Health Summary');
    let summary = `This report covers your maternal health journey during ${dateRangeText}. `;
    
    if (pregnancy) {
      summary += `You are currently ${pregnancyWeek} weeks pregnant with an expected due date of ${pregnancy.expectedDeliveryDate ? new Date(pregnancy.expectedDeliveryDate).toLocaleDateString() : 'N/A'}. `;
      if (daysRemaining > 0) {
        summary += `You have approximately ${daysRemaining} days until your expected delivery. `;
      }
    }
    
    summary += `You have attended ${completedVisits.length} visits and received ${completedVaccinations.length} vaccinations during this period. `;
    
    if (upcomingVisits.length > 0) {
      summary += `You have ${upcomingVisits.length} upcoming appointment(s) scheduled. `;
    }
    
    if (mother.assignedMidwife) {
      summary += `Your dedicated midwife ${mother.assignedMidwife.user.name} is available to support you throughout your pregnancy journey.`;
    }

    pdf.addParagraph(summary);

    // Important Reminders
    pdf.addSpace(10);
    pdf.addSectionTitle('Important Reminders');
    const reminders = [];
    
    if (upcomingVisits.length > 0) {
      const nextVisit = upcomingVisits[0];
      reminders.push(`• Next appointment: ${new Date(nextVisit.visitDate).toLocaleDateString()} at ${new Date(nextVisit.visitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
    }
    
    if (pregnancy?.highRisk) {
      reminders.push('• ⚠ This is a high-risk pregnancy - attend all scheduled appointments');
    }
    
    reminders.push('• Take prescribed vitamins and supplements daily');
    reminders.push('• Maintain a healthy diet and stay hydrated');
    reminders.push('• Contact your midwife immediately if you experience any unusual symptoms');
    reminders.push('• Keep all medical documents and test results organized');
    
    reminders.forEach((reminder) => {
      pdf.addParagraph(reminder, 10);
    });

    // Add footer
    pdf.addFooter(mother.user.name || 'Mother');

    // Return PDF as response
    const pdfBuffer = Buffer.from(pdf.getArrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="my-health-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Mother Reports - Health] Error generating report:', error);
    console.error('[Mother Reports - Health] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
