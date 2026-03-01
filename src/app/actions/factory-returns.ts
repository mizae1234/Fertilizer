'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function createFactoryReturn(data: {
    vendorId: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
    }[];
    senderName?: string;
    receiverName?: string;
    notes?: string;
    userId: string;
}) {
    if (!data.vendorId) throw new Error('กรุณาเลือกผู้ส่งสินค้า');
    if (!data.items.length) throw new Error('กรุณาเพิ่มรายการสินค้า');
    if (!data.userId) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');

    const totalAmount = data.items.reduce((sum, item) => item.quantity * item.unitCost + sum, 0);
    const returnNumber = await generateNumber('FR');

    const result = await prisma.$transaction(async (tx) => {
        const factoryReturn = await tx.factoryReturn.create({
            data: {
                returnNumber,
                vendorId: data.vendorId,
                totalAmount,
                notes: data.notes || null,
                senderName: data.senderName || null,
                receiverName: data.receiverName || null,
                createdById: data.userId,
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost,
                    })),
                },
            },
        });

        // Deduct stock + create stock transactions
        await Promise.all(data.items.map(async (item) => {
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                update: { quantity: { decrement: item.quantity } },
                create: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: -item.quantity,
                },
            });

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'FACTORY_RETURN',
                    quantity: -item.quantity,
                    unitCost: item.unitCost,
                    reference: returnNumber,
                    userId: data.userId,
                    notes: `เคลมคืนโรงงาน ${returnNumber}`,
                },
            });
        }));

        return factoryReturn;
    });

    revalidatePath('/factory-returns');
    return { id: result.id, returnNumber: result.returnNumber };
}

export async function getFactoryReturns(page = 1, from = '', to = '') {
    const perPage = 15;
    const where: Record<string, unknown> = { deletedAt: null };

    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const [records, total] = await Promise.all([
        prisma.factoryReturn.findMany({
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
        prisma.factoryReturn.count({ where }),
    ]);

    return { records, totalPages: Math.ceil(total / perPage), total };
}

export async function cancelFactoryReturn(id: string) {
    const fr = await prisma.factoryReturn.findUnique({
        where: { id },
        include: { items: true },
    });
    if (!fr) throw new Error('ไม่พบรายการเคลมคืน');
    if (fr.status === 'CANCELLED') throw new Error('รายการนี้ถูกยกเลิกแล้ว');

    await prisma.$transaction(async (tx) => {
        // Look up original FACTORY_RETURN stock transactions for base-unit quantities
        const originalTxs = await tx.stockTransaction.findMany({
            where: { reference: fr.returnNumber, type: 'FACTORY_RETURN' },
        });

        for (const item of fr.items) {
            // Find matching stock transaction for this product+warehouse
            const matchingTx = originalTxs.find(
                st => st.productId === item.productId && st.warehouseId === item.warehouseId
            );
            const qtyToRestore = matchingTx ? Math.abs(matchingTx.quantity) : item.quantity;

            // Restore stock
            await tx.productStock.update({
                where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                data: { quantity: { increment: qtyToRestore } },
            });

            // Create cancellation stock transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'FACTORY_RETURN',
                    quantity: qtyToRestore,
                    unitCost: item.unitCost,
                    reference: fr.returnNumber,
                    userId: fr.createdById,
                    notes: `ยกเลิกเคลมคืนโรงงาน ${fr.returnNumber}`,
                },
            });
        }

        await tx.factoryReturn.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
    });

    revalidatePath('/factory-returns');
    revalidatePath(`/factory-returns/${id}`);
}
