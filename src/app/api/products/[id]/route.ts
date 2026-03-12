import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const url = new URL(request.url);
    const txFrom = url.searchParams.get('txFrom');
    const txTo = url.searchParams.get('txTo');

    // Build stockTransactions where clause
    const txWhere: Record<string, unknown> = {};
    if (txFrom) txWhere.createdAt = { ...(txWhere.createdAt as object || {}), gte: new Date(txFrom) };
    if (txTo) {
        const toDate = new Date(txTo);
        toDate.setHours(23, 59, 59, 999);
        txWhere.createdAt = { ...(txWhere.createdAt as object || {}), lte: toDate };
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                productGroup: { select: { name: true } },
                productStocks: {
                    include: { warehouse: { select: { id: true, name: true } } },
                },
                productPrices: {
                    include: { customerGroup: { select: { name: true } }, productUnit: { select: { id: true, unitName: true } } },
                },
                productUnits: {
                    orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }],
                },
                stockTransactions: {
                    where: Object.keys(txWhere).length > 0 ? txWhere : undefined,
                    include: {
                        warehouse: { select: { name: true } },
                        user: { select: { name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                },
                productLogs: {
                    include: { user: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                },
            },
        });

        if (!product) {
            return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
        }

        // When date filter is applied, compute sum of transactions AFTER the filter
        // so the client can calculate accurate starting balance
        let txSumAfterFilter: number | null = null;
        if (txFrom || txTo) {
            const afterWhere: Record<string, unknown> = { productId: id };
            if (txTo) {
                const toDate = new Date(txTo);
                toDate.setHours(23, 59, 59, 999);
                afterWhere.createdAt = { gt: toDate };
            }
            // If only txFrom is set (no txTo), we don't need afterSum since newest tx = current stock
            if (txTo) {
                const afterAgg = await prisma.stockTransaction.aggregate({
                    where: afterWhere,
                    _sum: { quantity: true },
                });
                txSumAfterFilter = afterAgg._sum.quantity ?? 0;
            }
        }

        // Serialize Decimal objects to plain values
        const result = JSON.parse(JSON.stringify(product));
        if (txSumAfterFilter !== null) {
            result.txSumAfterFilter = txSumAfterFilter;
        }
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Product GET error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    // Only allow known Product scalar fields
    const allowedFields = [
        'name', 'description', 'unit', 'cost', 'price', 'brand',
        'packaging', 'productGroupId', 'pointsPerUnit', 'minStock', 'isActive', 'code', 'imageUrl'
    ];
    const data: Record<string, any> = {};
    for (const key of allowedFields) {
        if (key in body) {
            data[key] = body[key];
        }
    }

    // Extract userId from cookie for audit logging
    let userId: string | null = null;
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.split('; ').find(c => c.startsWith('token='));
        if (tokenMatch) {
            const token = tokenMatch.split('=')[1];
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            userId = payload.userId || null;
        }
    } catch { /* ignore */ }

    try {
        // Check for duplicate code if code is being updated
        if (data.code) {
            const existing = await prisma.product.findFirst({
                where: { code: data.code, id: { not: id } },
                select: { id: true, name: true },
            });
            if (existing) {
                return NextResponse.json(
                    { error: `รหัสสินค้า "${data.code}" ถูกใช้แล้วโดยสินค้า "${existing.name}"` },
                    { status: 400 }
                );
            }
        }

        // Fetch old product data for comparison
        const oldProduct = await prisma.product.findUnique({ where: { id } });
        if (!oldProduct) {
            return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
        }

        const updated = await prisma.product.update({
            where: { id },
            data,
        });

        // Create audit log entries for each changed field
        const fieldLabels: Record<string, string> = {
            name: 'ชื่อสินค้า', code: 'รหัสสินค้า', unit: 'หน่วยนับ',
            cost: 'ราคาทุน', price: 'ราคาขาย', brand: 'แบรนด์',
            packaging: 'บรรจุภัณฑ์', productGroupId: 'กลุ่มสินค้า',
            pointsPerUnit: 'แต้มต่อหน่วย', minStock: 'สต็อกขั้นต่ำ',
            isActive: 'สถานะ', description: 'คำอธิบาย', imageUrl: 'รูปภาพ',
        };
        const logEntries: { field: string; oldValue: string; newValue: string; details: string }[] = [];
        for (const key of Object.keys(data)) {
            const oldVal = String(oldProduct[key as keyof typeof oldProduct] ?? '');
            const newVal = String(data[key] ?? '');
            if (oldVal !== newVal) {
                const label = fieldLabels[key] || key;
                logEntries.push({
                    field: key,
                    oldValue: oldVal,
                    newValue: newVal,
                    details: `แก้ไข${label}: "${oldVal}" → "${newVal}"`,
                });
            }
        }
        if (logEntries.length > 0) {
            await prisma.productLog.createMany({
                data: logEntries.map(e => ({
                    productId: id,
                    userId,
                    action: 'UPDATE',
                    field: e.field,
                    oldValue: e.oldValue,
                    newValue: e.newValue,
                    details: e.details,
                })),
            });
        }

        return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    } catch (error: any) {
        console.error('Product PATCH error:', error.message, JSON.stringify(data));
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
