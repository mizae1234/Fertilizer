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
                take: 20,
                ...(hasDateFilter ? { where: { createdAt: dateFilter } } : {}),
                include: {
                    items: {
                        select: { quantity: true, unitPrice: true, totalPrice: true, product: { select: { name: true, code: true } }, warehouse: { select: { name: true } } },
                    },
                },
            },
        },
    });

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(customer);
}
