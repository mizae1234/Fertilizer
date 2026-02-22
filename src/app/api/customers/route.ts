import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const customers = await prisma.customer.findMany({
        where: {
            deletedAt: null,
            ...(search
                ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search } },
                    ],
                }
                : {}),
        },
        include: {
            customerGroup: { select: { name: true, id: true } },
        },
        take: 50,
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(customers);
}
