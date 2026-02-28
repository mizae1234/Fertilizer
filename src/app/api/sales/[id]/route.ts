import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true, productUnits: { select: { unitName: true, conversionRate: true } } } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!sale) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
}
