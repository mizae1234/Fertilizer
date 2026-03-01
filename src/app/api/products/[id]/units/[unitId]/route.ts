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

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; unitId: string }> }
) {
    const { id, unitId } = await params;
    const body = await request.json();

    const { unitName, conversionRate, sellingPrice, isBaseUnit } = body;

    const existing = await prisma.productUnit.findUnique({ where: { id: unitId } });
    if (!existing || existing.productId !== id) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลหน่วยขาย' }, { status: 404 });
    }

    // If changing to base unit, conversion rate must be 1
    if (isBaseUnit && Number(conversionRate) !== 1) {
        return NextResponse.json(
            { error: 'หน่วยหลัก (Base Unit) ต้องมี Conversion Rate = 1' },
            { status: 400 }
        );
    }

    // Cannot change base unit flag if it's the only base unit
    if (existing.isBaseUnit && !isBaseUnit) {
        return NextResponse.json(
            { error: 'ไม่สามารถเปลี่ยนหน่วยหลักเป็นหน่วยทั่วไปได้' },
            { status: 400 }
        );
    }

    // If setting as base unit, check no other base unit exists
    if (isBaseUnit && !existing.isBaseUnit) {
        const otherBase = await prisma.productUnit.findFirst({
            where: { productId: id, isBaseUnit: true, id: { not: unitId } },
        });
        if (otherBase) {
            return NextResponse.json(
                { error: 'สินค้านี้มีหน่วยหลักแล้ว' },
                { status: 400 }
            );
        }
    }

    try {
        const unit = await prisma.productUnit.update({
            where: { id: unitId },
            data: { unitName, conversionRate, sellingPrice, isBaseUnit },
        });
        // Log changes
        const changes: string[] = [];
        if (existing.unitName !== unitName) changes.push(`ชื่อ: "${existing.unitName}" → "${unitName}"`);
        if (Number(existing.conversionRate) !== Number(conversionRate)) changes.push(`อัตราแปลง: ${existing.conversionRate} → ${conversionRate}`);
        if (Number(existing.sellingPrice) !== Number(sellingPrice)) changes.push(`ราคา: ${existing.sellingPrice} → ${sellingPrice}`);
        if (changes.length > 0) {
            await prisma.productLog.create({
                data: {
                    productId: id,
                    userId: getUserId(request),
                    action: 'UPDATE_UNIT',
                    field: 'productUnit',
                    oldValue: `${existing.unitName} (x${existing.conversionRate}) ราคา ${existing.sellingPrice}`,
                    newValue: `${unitName} (x${conversionRate}) ราคา ${sellingPrice}`,
                    details: `แก้ไขหน่วยขาย "${unitName}": ${changes.join(', ')}`,
                },
            });
        }
        return NextResponse.json(unit);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json(
                { error: `หน่วย "${unitName}" มีอยู่แล้วในสินค้านี้` },
                { status: 400 }
            );
        }
        throw error;
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; unitId: string }> }
) {
    const { id, unitId } = await params;

    const existing = await prisma.productUnit.findUnique({ where: { id: unitId } });
    if (!existing || existing.productId !== id) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลหน่วยขาย' }, { status: 404 });
    }

    if (existing.isBaseUnit) {
        return NextResponse.json(
            { error: 'ไม่สามารถลบหน่วยหลัก (Base Unit) ได้' },
            { status: 400 }
        );
    }

    await prisma.productUnit.delete({ where: { id: unitId } });
    await prisma.productLog.create({
        data: {
            productId: id,
            userId: getUserId(request),
            action: 'DELETE_UNIT',
            field: 'productUnit',
            oldValue: `${existing.unitName} (x${existing.conversionRate}) ราคา ${existing.sellingPrice}`,
            details: `ลบหน่วยขาย "${existing.unitName}"`,
        },
    });
    return NextResponse.json({ success: true });
}
