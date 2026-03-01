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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const units = await prisma.productUnit.findMany({
        where: { productId: id },
        orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }],
    });
    return NextResponse.json(units);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    const { unitName, conversionRate, sellingPrice, isBaseUnit } = body;

    if (!unitName || conversionRate === undefined || sellingPrice === undefined) {
        return NextResponse.json(
            { error: 'กรุณากรอกข้อมูลให้ครบ (unitName, conversionRate, sellingPrice)' },
            { status: 400 }
        );
    }

    // If setting as base unit, conversion rate must be 1
    if (isBaseUnit && Number(conversionRate) !== 1) {
        return NextResponse.json(
            { error: 'หน่วยหลัก (Base Unit) ต้องมี Conversion Rate = 1' },
            { status: 400 }
        );
    }

    // Check if base unit already exists when trying to add another base unit
    if (isBaseUnit) {
        const existingBase = await prisma.productUnit.findFirst({
            where: { productId: id, isBaseUnit: true },
        });
        if (existingBase) {
            return NextResponse.json(
                { error: 'สินค้านี้มีหน่วยหลักแล้ว ไม่สามารถเพิ่มหน่วยหลักซ้ำได้' },
                { status: 400 }
            );
        }
    }

    try {
        const unit = await prisma.productUnit.create({
            data: {
                productId: id,
                unitName,
                conversionRate,
                sellingPrice,
                isBaseUnit: isBaseUnit || false,
            },
        });
        await prisma.productLog.create({
            data: {
                productId: id,
                userId: getUserId(request),
                action: 'ADD_UNIT',
                field: 'productUnit',
                newValue: `${unitName} (x${conversionRate}) ราคา ${sellingPrice}`,
                details: `เพิ่มหน่วยขาย "${unitName}" อัตราแปลง ${conversionRate} ราคา ${sellingPrice}`,
            },
        });
        return NextResponse.json(unit, { status: 201 });
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
