import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            customerGroup: { select: { name: true } },
            pointTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 50,
                ...(hasDateFilter ? { where: { createdAt: dateFilter } } : {}),
            },
            sales: {
                orderBy: { createdAt: 'desc' },
                ...(hasDateFilter ? { where: { createdAt: dateFilter, status: 'APPROVED', deletedAt: null } } : { where: { status: 'APPROVED', deletedAt: null } }),
                include: {
                    items: {
                        select: { id: true, quantity: true, unitPrice: true, totalPrice: true, product: { select: { name: true, code: true, unit: true } }, warehouse: { select: { name: true } } },
                    },
                    saleReturns: {
                        select: {
                            items: {
                                select: { saleItemId: true, quantity: true }
                            }
                        }
                    },
                },
            },
        },
    });

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sales = customer.sales.map(sale => {
        const retMap = new Map<string, number>();
        for (const sr of sale.saleReturns || []) {
            for (const ri of sr.items || []) {
                retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
            }
        }
        const adjustedItems = sale.items
            .map(it => {
                const returned = retMap.get(it.id) || 0;
                const remaining = Math.max(0, it.quantity - returned);
                const unitPrice = Number(it.unitPrice);
                return {
                    ...it,
                    originalQuantity: it.quantity,
                    returnedQuantity: returned,
                    quantity: remaining,
                    unitPrice,
                    totalPrice: remaining * unitPrice,
                };
            })
            .filter(it => it.quantity > 0);

        return {
            ...sale,
            items: adjustedItems,
        };
    });

    return NextResponse.json({
        ...customer,
        sales,
    });
}
