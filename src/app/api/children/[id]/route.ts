import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { computeGrowthMetrics } from '@/lib/growthUtils';

// Get single child
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const child = await prisma.child.findUnique({
      where: { id },
      include: {
        mother: {
          include: {
            user: { select: { name: true, email: true } },
            assignedMidwife: {
              include: { user: { select: { name: true } } },
            },
          },
        },
        growthRecords: {
          orderBy: { recordDate: 'desc' },
        },
        vaccinations: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
    });

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Check access permissions
    if (session.user.role === 'MOTHER' && child.motherId !== session.user.motherId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (session.user.role === 'MIDWIFE' && child.mother.assignedMidwifeId !== session.user.midwifeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ data: child });
  } catch (error) {
    console.error('Get child error:', error);
    return NextResponse.json({ error: 'Failed to fetch child' }, { status: 500 });
  }
}

// Update child (Admin/Midwife only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'MIDWIFE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Only Admin/Midwife can update child records' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Find the child first
    const existingChild = await prisma.child.findUnique({
      where: { id },
      include: { mother: true },
    });

    if (!existingChild) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Midwife can only update children for their assigned mothers
    if (session.user.role === 'MIDWIFE' && session.user.midwifeId) {
      if (existingChild.mother.assignedMidwifeId !== session.user.midwifeId) {
        return NextResponse.json(
          { error: 'You can only update records for your assigned mothers\' children' },
          { status: 403 }
        );
      }
    }

    const {
      name,
      gender,
      birthDate,
      birthWeight,
      birthHeight,
      birthTime,
      birthPlace,
      healthNotes,
      isPreterm,
      gestationalAgeWeeks,
    } = body;

    // Build update data
    const updateData: {
      name?: string;
      gender?: 'MALE' | 'FEMALE';
      birthDate?: Date;
      birthWeight?: number | null;
      birthHeight?: number | null;
      birthTime?: string | null;
      birthPlace?: string | null;
      healthNotes?: string | null;
      isPreterm?: boolean;
      gestationalAgeWeeks?: number | null;
    } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (gender !== undefined) {
      updateData.gender = gender;
    }

    if (birthDate !== undefined) {
      updateData.birthDate = new Date(birthDate);
    }

    if (birthWeight !== undefined) {
      updateData.birthWeight = birthWeight ? parseFloat(birthWeight) : null;
    }

    if (birthHeight !== undefined) {
      updateData.birthHeight = birthHeight ? parseFloat(birthHeight) : null;
    }

    if (birthTime !== undefined) {
      updateData.birthTime = birthTime || null;
    }

    if (birthPlace !== undefined) {
      updateData.birthPlace = birthPlace || null;
    }

    if (healthNotes !== undefined) {
      updateData.healthNotes = healthNotes || null;
    }

    if (isPreterm !== undefined) {
      updateData.isPreterm = Boolean(isPreterm);
    }

    if (gestationalAgeWeeks !== undefined) {
      updateData.gestationalAgeWeeks = gestationalAgeWeeks ? parseInt(gestationalAgeWeeks) : null;
    }

    const child = await prisma.child.update({
      where: { id },
      data: updateData,
      include: {
        mother: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    // Update growth record if birth measurements or related calculation parameters changed
    if (
      birthWeight !== undefined ||
      birthHeight !== undefined ||
      gender !== undefined ||
      birthDate !== undefined ||
      isPreterm !== undefined ||
      gestationalAgeWeeks !== undefined
    ) {
      const birthGrowthRecord = await prisma.growthRecord.findFirst({
        where: {
          childId: id,
          notes: 'Birth measurements',
        },
      });

      const birthDateObj = new Date(child.birthDate);
      const computed = computeGrowthMetrics({
        birthDate: birthDateObj,
        recordDate: birthDateObj,
        gender: child.gender as 'MALE' | 'FEMALE',
        weightKg: child.birthWeight ? parseFloat(child.birthWeight.toString()) : null,
        heightCm: child.birthHeight ? parseFloat(child.birthHeight.toString()) : null,
        isPreterm: child.isPreterm,
        gestationalAgeWeeks: child.gestationalAgeWeeks,
      });

      if (birthGrowthRecord) {
        await prisma.growthRecord.update({
          where: { id: birthGrowthRecord.id },
          data: {
            weight: child.birthWeight,
            height: child.birthHeight,
            bmi: computed.bmi,
            correctedAgeMonths: computed.correctedAgeMonths,
            zScoreWeight: computed.weightStatus?.zScore ?? null,
            zScoreHeight: computed.heightStatus?.zScore ?? null,
            zScoreBmi: computed.bmiStatus?.zScore ?? null,
            weightStatus: computed.weightStatus?.status ?? null,
            heightStatus: computed.heightStatus?.status ?? null,
            bmiStatus: computed.bmiStatus?.status ?? null,
            recordDate: birthDateObj,
          },
        });
      } else if (child.birthWeight || child.birthHeight) {
        await prisma.growthRecord.create({
          data: {
            childId: id,
            recordDate: birthDateObj,
            weight: child.birthWeight,
            height: child.birthHeight,
            bmi: computed.bmi,
            ageMonths: 0,
            correctedAgeMonths: computed.correctedAgeMonths,
            zScoreWeight: computed.weightStatus?.zScore ?? null,
            zScoreHeight: computed.heightStatus?.zScore ?? null,
            zScoreBmi: computed.bmiStatus?.zScore ?? null,
            weightStatus: computed.weightStatus?.status ?? null,
            heightStatus: computed.heightStatus?.status ?? null,
            bmiStatus: computed.bmiStatus?.status ?? null,
            notes: 'Birth measurements',
          },
        });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CHILD_UPDATED',
        entity: 'Child',
        entityId: id,
        details: `Child record updated for ${child.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Child record updated successfully',
      data: child,
    });
  } catch (error) {
    console.error('Update child error:', error);
    return NextResponse.json({ error: 'Failed to update child' }, { status: 500 });
  }
}

// Delete child (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Only Admin can delete child records' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const child = await prisma.child.findUnique({
      where: { id },
      include: { mother: { include: { user: true } } },
    });

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Delete or update related records first to prevent foreign key errors
    await prisma.growthRecord.deleteMany({ where: { childId: id } });
    await prisma.childGrowthRecord.deleteMany({ where: { childId: id } });
    await prisma.vaccination.deleteMany({ where: { childId: id } });
    await prisma.visit.deleteMany({ where: { childId: id } });
    await prisma.thriposhaDistribution.deleteMany({ where: { childId: id } });

    await prisma.child.delete({ where: { id } });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CHILD_DELETED',
        entity: 'Child',
        entityId: id,
        details: `Child record deleted for ${child.name} (Mother: ${child.mother.user.name})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Child record deleted successfully',
    });
  } catch (error) {
    console.error('Delete child error:', error);
    return NextResponse.json({ error: 'Failed to delete child' }, { status: 500 });
  }
}