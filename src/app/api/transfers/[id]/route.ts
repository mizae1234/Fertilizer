import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getServerUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const transfer = await prisma.stockTransfer.findFirst({
        where: { id, deletedAt: null },
        include: {
            fromWarehouse: { select: { id: true, name: true } },
            toWarehouse: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
            cancelledBy: { select: { name: true } },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            unit: true,
                            productStocks: {
                                select: { warehouseId: true, quantity: true },
                            },
                        },
                    },
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
