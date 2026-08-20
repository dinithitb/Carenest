import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PassThrough } from 'stream';

// @ts-expect-error archiver types mismatch with v8 named export
import { ZipArchive } from 'archiver';

export async function GET(req: NextRequest) {
    try {
        // 1. Verify user authentication
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Extract filter params
        const { searchParams } = req.nextUrl;
        const range = searchParams.get('range');
        const docTypeId = searchParams.get('type');
        const motherId = searchParams.get('motherId');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        if (!motherId) {
            return new NextResponse('Mother ID is required', { status: 400 });
        }

        // Security: mothers can only access their own documents
        if (session.user.role === 'MOTHER' && session.user.motherId !== motherId) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // 3. Build query filter
        const whereClause: Record<string, unknown> = { motherId };

        if (docTypeId && docTypeId !== 'all') {
            whereClause.documentTypeId = docTypeId;
        }

        if (range && range !== 'all') {
            const now = new Date();
            const startBoundary = new Date();

            if (range === 'custom' && startDateParam && endDateParam) {
                const parsedStart = new Date(startDateParam);
                const parsedEnd = new Date(endDateParam);
                parsedEnd.setHours(23, 59, 59, 999);
                whereClause.uploadedAt = { gte: parsedStart, lte: parsedEnd };
            } else if (range === 'week') {
                startBoundary.setDate(now.getDate() - 7);
                whereClause.uploadedAt = { gte: startBoundary };
            } else if (range === 'month') {
                startBoundary.setMonth(now.getMonth() - 1);
                whereClause.uploadedAt = { gte: startBoundary };
            }
        }

        // 4. Fetch matching documents
        const documents = await prisma.document.findMany({
            where: whereClause,
            orderBy: { uploadedAt: 'desc' },
        });

        if (documents.length === 0) {
            return new NextResponse('No matching documents found', { status: 404 });
        }

        // 5. Single file: stream directly as PDF
        if (documents.length === 1) {
            const singleDoc = documents[0];
            if (!singleDoc.fileData) {
                return new NextResponse('File content is empty', { status: 500 });
            }
            const buf = Buffer.from(singleDoc.fileData);
            return new NextResponse(new Uint8Array(buf), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(singleDoc.fileName)}"`,
                    'Content-Length': buf.length.toString(),
                },
            });
        }

        // 6. Multiple files: collect zip into memory buffer, then return
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
            const pass = new PassThrough();
            const chunks: Buffer[] = [];

            pass.on('data', (chunk: Buffer) => chunks.push(chunk));
            pass.on('end', () => resolve(Buffer.concat(chunks)));
            pass.on('error', reject);

            const zip = new ZipArchive({ zlib: { level: 6 } });
            zip.on('error', reject);
            zip.pipe(pass);

            for (const doc of documents) {
                if (doc.fileData) {
                    zip.append(Buffer.from(doc.fileData), { name: doc.fileName });
                }
            }

            zip.finalize();
        });

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="CareNest_Health_Reports_${motherId.substring(0, 6)}.zip"`,
                'Content-Length': zipBuffer.length.toString(),
                'Cache-Control': 'no-store, must-revalidate',
            },
        });

    } catch (error) {
        console.error('Bulk download error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
