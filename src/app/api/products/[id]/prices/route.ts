import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { customerGroupId, price } = body;

    if (!customerGroupId || price === undefined) {
        return NextResponse.json({ error: 'กรุณาเลือกกลุ่มลูกค้าและกรอกราคา' }, { status: 400 });
    }

    try {
        const pp = await prisma.productPrice.upsert({
            where: { productId_customerGroupId: { productId: id, customerGroupId } },
            update: { price },
            create: { productId: id, customerGroupId, price },
            include: { customerGroup: { select: { name: true } } },
        });
        return NextResponse.json(JSON.parse(JSON.stringify(pp)), { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const priceId = searchParams.get('priceId');

    if (!priceId) {
        return NextResponse.json({ error: 'ไม่ระบุ priceId' }, { status: 400 });
    }

    const existing = await prisma.productPrice.findUnique({ where: { id: priceId } });
    if (!existing || existing.productId !== id) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลราคา' }, { status: 404 });
    }

    await prisma.productPrice.delete({ where: { id: priceId } });
    return NextResponse.json({ success: true });
}
