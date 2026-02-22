import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const gr = await prisma.goodsReceive.findUnique({
        where: { id },
        include: {
            vendor: { select: { id: true, name: true, phone: true, lineId: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!gr) {
        return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
    }

    return NextResponse.json(gr);
}
