import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = 20;

    const where = { productId: id };

    const [transactions, total] = await Promise.all([
        prisma.stockTransaction.findMany({
            where,
            include: {
                warehouse: { select: { name: true } },
                user: { select: { name: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.stockTransaction.count({ where }),
    ]);

    return NextResponse.json({
        transactions: transactions.map(t => ({
            ...t,
            unitCost: Number(t.unitCost),
        })),
        totalPages: Math.ceil(total / perPage),
        total,
    });
}
