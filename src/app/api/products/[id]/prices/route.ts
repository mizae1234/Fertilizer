import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserId(request: Request): string | null {
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.split('; ').find(c => c.startsWith('token='));
        if (tokenMatch) {
            const token = tokenMatch.split('=')[1];
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            return payload.userId || null;
        }
    } catch { /* ignore */ }
    return null;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { customerGroupId, price, productUnitId } = body;

    if (!customerGroupId || price === undefined) {
        return NextResponse.json({ error: 'กรุณาเลือกกลุ่มลูกค้าและกรอกราคา' }, { status: 400 });
    }

    const unitId = productUnitId || null;

    try {
        // Check if this exact combo exists
        const existing = await prisma.productPrice.findFirst({
            where: { productId: id, customerGroupId, productUnitId: unitId },
        });

        let pp;
        if (existing) {
            pp = await prisma.productPrice.update({
                where: { id: existing.id },
                data: { price },
                include: { customerGroup: { select: { name: true } }, productUnit: { select: { id: true, unitName: true } } },
            });
            if (Number(existing.price) !== Number(price)) {
                const unitLabel = pp.productUnit ? pp.productUnit.unitName : 'หลัก';
                await prisma.productLog.create({
                    data: {
                        productId: id,
                        userId: getUserId(request),
                        action: 'UPDATE_PRICE',
                        field: 'productPrice',
                        oldValue: `${pp.customerGroup.name} (${unitLabel}): ${existing.price}`,
                        newValue: `${pp.customerGroup.name} (${unitLabel}): ${price}`,
                        details: `แก้ไขราคากลุ่ม "${pp.customerGroup.name}" (${unitLabel}): ${existing.price} → ${price}`,
                    },
                });
            }
        } else {
            pp = await prisma.productPrice.create({
                data: { productId: id, customerGroupId, productUnitId: unitId, price },
                include: { customerGroup: { select: { name: true } }, productUnit: { select: { id: true, unitName: true } } },
            });
            const unitLabel = pp.productUnit ? pp.productUnit.unitName : 'หลัก';
            await prisma.productLog.create({
                data: {
                    productId: id,
                    userId: getUserId(request),
                    action: 'ADD_PRICE',
                    field: 'productPrice',
                    newValue: `${pp.customerGroup.name} (${unitLabel}): ${price}`,
                    details: `เพิ่มราคากลุ่ม "${pp.customerGroup.name}" (${unitLabel}): ${price}`,
                },
            });
        }

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

    const existing = await prisma.productPrice.findUnique({
        where: { id: priceId },
        include: { customerGroup: { select: { name: true } }, productUnit: { select: { unitName: true } } },
    });
    if (!existing || existing.productId !== id) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลราคา' }, { status: 404 });
    }

    await prisma.productPrice.delete({ where: { id: priceId } });
    const unitLabel = existing.productUnit ? existing.productUnit.unitName : 'หลัก';
    await prisma.productLog.create({
        data: {
            productId: id,
            userId: getUserId(request),
            action: 'DELETE_PRICE',
            field: 'productPrice',
            oldValue: `${existing.customerGroup.name} (${unitLabel}): ${existing.price}`,
            details: `ลบราคากลุ่ม "${existing.customerGroup.name}" (${unitLabel})`,
        },
    });
    return NextResponse.json({ success: true });
}
