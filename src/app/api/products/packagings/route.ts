import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const products = await prisma.product.findMany({
        where: { deletedAt: null, packaging: { not: null } },
        select: { packaging: true },
        distinct: ['packaging'],
        orderBy: { packaging: 'asc' },
    });

    const packagings = products
        .map(p => p.packaging)
        .filter((v): v is string => !!v && v.trim() !== '');

    return NextResponse.json(packagings);
}
