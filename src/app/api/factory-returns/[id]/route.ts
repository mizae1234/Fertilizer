import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const fr = await prisma.factoryReturn.findUnique({
        where: { id },
        include: {
            vendor: { select: { name: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!fr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(fr);
}
