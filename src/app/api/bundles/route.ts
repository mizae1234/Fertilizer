import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const bundles = await prisma.productBundle.findMany({
            where: { isActive: true, deletedAt: null },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, code: true, price: true, unit: true },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(JSON.parse(JSON.stringify(bundles)));
    } catch (error: any) {
        console.error('GET /api/bundles ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
