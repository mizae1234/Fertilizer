import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const transfer = await prisma.stockTransfer.findUnique({
        where: { id: params.id },
        include: {
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!transfer) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(transfer);
}
