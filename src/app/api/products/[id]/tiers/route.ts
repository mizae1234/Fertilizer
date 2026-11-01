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
    try {
        const tiers = await prisma.productPriceTier.findMany({
            where: { productId: id },
            include: { productUnit: { select: { id: true, unitName: true } } },
            orderBy: [{ productUnitId: 'asc' }, { minQuantity: 'asc' }],
        });
        return NextResponse.json(tiers);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { tierId, productUnitId, minQuantity, price } = body;

    const minQty = parseInt(minQuantity);
    const unitPrice = parseFloat(price);

    if (isNaN(minQty) || minQty < 1) {
        return NextResponse.json({ error: 'จำนวนขั้นต่ำต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป' }, { status: 400 });
    }
    if (isNaN(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ error: 'ราคาต้องเป็นตัวเลขที่ถูกต้อง' }, { status: 400 });
    }

    const normUnitId = productUnitId || null;

    try {
        let tier;
        if (tierId) {
            // Update existing tier
            tier = await prisma.productPriceTier.update({
                where: { id: tierId },
                data: {
                    productUnitId: normUnitId,
                    minQuantity: minQty,
                    price: unitPrice,
                },
                include: { productUnit: { select: { id: true, unitName: true } } },
            });
        } else {
            // Check if tier with same product, unit, and minQuantity already exists
            const existing = await prisma.productPriceTier.findFirst({
                where: {
                    productId: id,
                    productUnitId: normUnitId,
                    minQuantity: minQty,
                },
            });

            if (existing) {
                tier = await prisma.productPriceTier.update({
                    where: { id: existing.id },
                    data: { price: unitPrice },
                    include: { productUnit: { select: { id: true, unitName: true } } },
                });
            } else {
                tier = await prisma.productPriceTier.create({
                    data: {
                        productId: id,
                        productUnitId: normUnitId,
                        minQuantity: minQty,
                        price: unitPrice,
                    },
                    include: { productUnit: { select: { id: true, unitName: true } } },
                });
            }
        }

        // Log action
        const unitLabel = tier.productUnit ? tier.productUnit.unitName : 'หน่วยหลัก';
        await prisma.productLog.create({
            data: {
                productId: id,
                userId: getUserId(request),
                action: 'PRICE_TIER_UPDATE',
                field: 'priceTier',
                newValue: `${unitLabel} (${minQty}+): ฿${unitPrice}`,
                details: `ตั้งขั้นราคา ${unitLabel} ซื้อตั้งแต่ ${minQty} ชิ้นขึ้นไป ราคา ฿${unitPrice}`,
            },
        }).catch(() => {});

        return NextResponse.json(tier);
    } catch (error: any) {
        console.error('POST /api/products/[id]/tiers ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const url = new URL(request.url);
    const tierId = url.searchParams.get('tierId');

    if (!tierId) {
        return NextResponse.json({ error: 'ไม่พบรหัสขั้นราคาที่ต้องการลบ' }, { status: 400 });
    }

    try {
        const deleted = await prisma.productPriceTier.delete({
            where: { id: tierId, productId: id },
            include: { productUnit: { select: { unitName: true } } },
        });

        // Log action
        const unitLabel = deleted.productUnit ? deleted.productUnit.unitName : 'หน่วยหลัก';
        await prisma.productLog.create({
            data: {
                productId: id,
                userId: getUserId(request),
                action: 'PRICE_TIER_DELETE',
                field: 'priceTier',
                oldValue: `${unitLabel} (${deleted.minQuantity}+): ฿${deleted.price}`,
                details: `ลบขั้นราคา ${unitLabel} ซื้อตั้งแต่ ${deleted.minQuantity} ชิ้นขึ้นไป`,
            },
        }).catch(() => {});

        return NextResponse.json({ success: true, deletedId: tierId });
    } catch (error: any) {
        console.error('DELETE /api/products/[id]/tiers ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
