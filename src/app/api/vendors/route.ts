import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const vendors = await prisma.vendor.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true },
    });
    return NextResponse.json(vendors);
}
