'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/utils';

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
            vendor: true,
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
            grNumber: generateNumber('GR'),
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
                })),
            },
        },
    });

    revalidatePath('/goods-receive');
    revalidatePath('/');
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
                    })),
                },
            },
        });
    });

    revalidatePath(`/goods-receive/${id}`);
    revalidatePath('/goods-receive');
    revalidatePath('/');
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

        // Update stock for each item
        for (const item of gr.items) {
            const existingStock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
            });

            if (existingStock) {
                // Calculate average cost
                const oldQty = existingStock.quantity;
                const oldCost = Number(existingStock.avgCost);
                const newQty = item.quantity;
                const newCost = Number(item.unitCost);
                const totalQty = oldQty + newQty;
                const avgCost =
                    totalQty > 0
                        ? ((oldQty * oldCost) + (newQty * newCost)) / totalQty
                        : newCost;

                await tx.productStock.update({
                    where: { id: existingStock.id },
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

            // Create stock transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'GOODS_RECEIVE',
                    quantity: item.quantity,
                    unitCost: Number(item.unitCost),
                    reference: gr.grNumber,
                    notes: `รับสินค้าจาก GR ${gr.grNumber}`,
                },
            });
        }
    });

    revalidatePath('/goods-receive');
    revalidatePath('/');
}

export async function rejectGoodsReceive(id: string) {
    await prisma.goodsReceive.update({
        where: { id },
        data: { status: 'REJECTED' },
    });
    revalidatePath('/goods-receive');
    revalidatePath('/');
}

export async function deleteGoodsReceive(id: string) {
    const gr = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!gr) throw new Error('ไม่พบรายการ');

    await prisma.goodsReceive.update({
        where: { id },
        data: { deletedAt: new Date() },
    });

    revalidatePath('/goods-receive');
    revalidatePath('/');
}
