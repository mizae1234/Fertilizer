import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const warehouses = await prisma.warehouse.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
    });
    return NextResponse.json(warehouses);
}
