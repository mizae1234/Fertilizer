'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function getGoodsReceives(page = 1, status = '') {
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    };

    const [records, total] = await Promise.all([
        prisma.goodsReceive.findMany({
            where,
            include: {
                vendor: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.goodsReceive.count({ where }),
    ]);

    return { records, totalPages: Math.ceil(total / perPage) };
}

export async function getGoodsReceiveDetail(id: string) {
    return prisma.goodsReceive.findUnique({
        where: { id },
        include: {
            vendor: { select: { id: true, name: true, phone: true, lineId: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });
}

export async function createGoodsReceive(data: {
    vendorId: string;
    poNumber?: string;
    notes?: string;
    receivedDate?: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
        lotNo?: string;
    }[];
    userId: string;
}) {
    const totalAmount = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0
    );

    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
        throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }

    const gr = await prisma.goodsReceive.create({
        data: {
            grNumber: await generateNumber('GR'),
            poNumber: data.poNumber || null,
            receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
            vendorId: data.vendorId,
            status: 'PENDING',
            totalAmount,
            notes: data.notes,
            createdById: data.userId,
            items: {
                create: data.items.map((item) => ({
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: item.quantity * item.unitCost,
                    lotNo: item.lotNo || null,
                })),
            },
        },
    });

    revalidatePath('/goods-receive');
    return gr;
}

export async function updateGoodsReceive(id: string, data: {
    vendorId: string;
    poNumber?: string;
    notes?: string;
    receivedDate?: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
        lotNo?: string;
    }[];
}) {
    const existing = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!existing || existing.status !== 'PENDING') {
        throw new Error('ไม่สามารถแก้ไขรายการที่ไม่ใช่สถานะรออนุมัติ');
    }

    const totalAmount = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost, 0
    );

    await prisma.$transaction(async (tx) => {
        // Delete old items
        await tx.goodsReceiveItem.deleteMany({ where: { goodsReceiveId: id } });

        // Update GR header + create new items
        await tx.goodsReceive.update({
            where: { id },
            data: {
                vendorId: data.vendorId,
                poNumber: data.poNumber || null,
                receivedDate: data.receivedDate ? new Date(data.receivedDate) : existing.receivedDate,
                notes: data.notes || null,
                totalAmount,
                items: {
                    create: data.items.map((item) => ({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost,
                        lotNo: item.lotNo || null,
                    })),
                },
            },
        });
    });

    revalidatePath('/goods-receive');

    // Return updated data so client doesn't need a second fetch
    return prisma.goodsReceive.findUnique({
        where: { id },
        include: {
            vendor: { select: { id: true, name: true, phone: true, lineId: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });
}

export async function approveGoodsReceive(id: string) {
    const gr = await prisma.goodsReceive.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!gr || gr.status !== 'PENDING') {
        throw new Error('ไม่สามารถอนุมัติได้');
    }

    await prisma.$transaction(async (tx) => {
        // Update GR status
        await tx.goodsReceive.update({
            where: { id },
            data: { status: 'APPROVED' },
        });

        // Fetch products for costMethod check
        const productIds = [...new Set(gr.items.map(i => i.productId))];
        const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, cost: true, costMethod: true, name: true },
        });
        const productMap = Object.fromEntries(products.map(p => [p.id, p]));

        // Update stock for each item — fetch all existing stocks in one query
        const existingStocks = await tx.productStock.findMany({
            where: {
                OR: gr.items.map(item => ({
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                })),
            },
        });

        // Run stock updates + transaction creates in parallel per item
        await Promise.all(gr.items.map(async (item) => {
            const key = `${item.productId}_${item.warehouseId}`;
            const existing = existingStocks.find(s => `${s.productId}_${s.warehouseId}` === key);

            if (existing) {
                const oldQty = existing.quantity;
                const oldCost = Number(existing.avgCost);
                const newQty = item.quantity;
                const newCost = Number(item.unitCost);
                const totalQty = oldQty + newQty;
                const avgCost = totalQty > 0
                    ? ((oldQty * oldCost) + (newQty * newCost)) / totalQty
                    : newCost;

                await tx.productStock.update({
                    where: { id: existing.id },
                    data: {
                        quantity: { increment: item.quantity },
                        avgCost: parseFloat(avgCost.toFixed(2)),
                        lastCost: Number(item.unitCost),
                    },
                });
            } else {
                await tx.productStock.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        avgCost: Number(item.unitCost),
                        lastCost: Number(item.unitCost),
                    },
                });
            }

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'GOODS_RECEIVE',
                    quantity: item.quantity,
                    unitCost: Number(item.unitCost),
                    reference: gr.grNumber,
                    lotNo: item.lotNo || null,
                    userId: gr.createdById,
                    notes: `รับสินค้าจาก GR ${gr.grNumber}`,
                },
            });
        }));

        // Update product.cost based on costMethod for each product
        for (const productId of productIds) {
            const prod = productMap[productId];
            if (!prod) continue;

            const method = prod.costMethod || 'MANUAL';
            if (method === 'MANUAL') continue; // Don't touch manual cost

            const oldCost = Number(prod.cost);

            if (method === 'AVG') {
                // Calculate weighted average from ALL GOODS_RECEIVE StockTransactions (same as product API)
                const allReceives = await tx.stockTransaction.findMany({
                    where: { productId, type: 'GOODS_RECEIVE', quantity: { gt: 0 } },
                    select: { quantity: true, unitCost: true },
                });
                const totalQty = allReceives.reduce((s, r) => s + r.quantity, 0);
                const totalCost = allReceives.reduce((s, r) => s + r.quantity * Number(r.unitCost), 0);
                const newAvgCost = totalQty > 0 ? Math.round(totalCost / totalQty * 100) / 100 : oldCost;

                await tx.product.update({
                    where: { id: productId },
                    data: { cost: parseFloat(newAvgCost.toFixed(2)) },
                });

                // Log cost change
                await tx.productLog.create({
                    data: {
                        productId,
                        userId: gr.createdById,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        oldValue: String(oldCost),
                        newValue: String(parseFloat(newAvgCost.toFixed(2))),
                        details: `อัพเดตต้นทุนเฉลี่ย จาก ฿${oldCost} → ฿${parseFloat(newAvgCost.toFixed(2))} (GR ${gr.grNumber})`,
                    },
                });
            } else if (method === 'LAST') {
                // Use latest cost from GR items for this product
                const grItem = gr.items.find(i => i.productId === productId);
                if (!grItem) continue;
                const newCost = Number(grItem.unitCost);

                await tx.product.update({
                    where: { id: productId },
                    data: { cost: newCost },
                });

                // Log cost change
                await tx.productLog.create({
                    data: {
                        productId,
                        userId: gr.createdById,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        oldValue: String(oldCost),
                        newValue: String(newCost),
                        details: `อัพเดตต้นทุนล่าสุด จาก ฿${oldCost} → ฿${newCost} (GR ${gr.grNumber})`,
                    },
                });
            }
        }
    });

    revalidatePath('/goods-receive');
}

export async function rejectGoodsReceive(id: string) {
    await prisma.goodsReceive.update({
        where: { id },
        data: { status: 'REJECTED' },
    });
    revalidatePath('/goods-receive');
}

export async function deleteGoodsReceive(id: string) {
    const gr = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!gr) throw new Error('ไม่พบรายการ');
    if (gr.status === 'APPROVED') throw new Error('ไม่สามารถลบรายการที่อนุมัติแล้วได้');

    await prisma.goodsReceive.update({
        where: { id },
        data: { deletedAt: new Date() },
    });

    revalidatePath('/goods-receive');
}

export async function updateGoodsReceivePayment(id: string, data: {
    goodsPaid: boolean;
    shippingPaid: boolean;
    shippingCost: number;
}) {
    const gr = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!gr) throw new Error('ไม่พบรายการ');

    await prisma.goodsReceive.update({
        where: { id },
        data: {
            goodsPaid: data.goodsPaid,
            shippingPaid: data.shippingPaid,
            shippingCost: data.shippingCost,
        },
    });

    revalidatePath('/goods-receive');
    revalidatePath(`/goods-receive/${id}`);
}
