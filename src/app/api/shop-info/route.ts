import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SHOP_INFO_ID = 'shop-info';

// GET: Fetch shop info (create default if not exists)
export async function GET() {
    try {
        let info = await prisma.shopInfo.findUnique({ where: { id: SHOP_INFO_ID } });
        if (!info) {
            info = await prisma.shopInfo.create({ data: { id: SHOP_INFO_ID } });
        }
        return NextResponse.json(info);
    } catch (error) {
        console.error('Error fetching shop info:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// PUT: Update shop info
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const info = await prisma.shopInfo.upsert({
            where: { id: SHOP_INFO_ID },
            update: {
                name: body.name || '',
                taxId: body.taxId || '',
                address: body.address || '',
                notes: body.notes || '',
                logoUrl: body.logoUrl ?? undefined,
            },
            create: {
                id: SHOP_INFO_ID,
                name: body.name || '',
                taxId: body.taxId || '',
                address: body.address || '',
                notes: body.notes || '',
                logoUrl: body.logoUrl || null,
            },
        });
        return NextResponse.json(info);
    } catch (error) {
        console.error('Error updating shop info:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
