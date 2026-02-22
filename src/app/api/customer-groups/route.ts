import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const groups = await prisma.customerGroup.findMany({
        include: { _count: { select: { customers: true, productPrices: true } } },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(groups);
}
