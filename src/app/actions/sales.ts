'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getSales(page = 1, status = '') {
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    };

    const [sales, total] = await Promise.all([
        prisma.sale.findMany({
            where,
            include: {
                customer: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.sale.count({ where }),
    ]);

    return { sales, totalPages: Math.ceil(total / perPage) };
}

export async function getSaleDetail(id: string) {
    return prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true } },
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

export async function approveSale(id: string) {
    const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!sale || sale.status !== 'PENDING') {
        throw new Error('ไม่สามารถอนุมัติได้');
    }

    // Validate stock
    for (const item of sale.items) {
        const stock = await prisma.productStock.findUnique({
            where: {
                productId_warehouseId: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                },
            },
        });

        if (!stock || stock.quantity < item.quantity) {
            throw new Error('สินค้ามี stock ไม่เพียงพอ');
        }
    }

    await prisma.$transaction(async (tx) => {
        // Update sale status
        await tx.sale.update({
            where: { id },
            data: { status: 'APPROVED' },
        });

        // Deduct stock for each item
        for (const item of sale.items) {
            await tx.productStock.update({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                data: {
                    quantity: { decrement: item.quantity },
                },
            });

            // Create stock transaction (OUT)
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'SALE',
                    quantity: -item.quantity,
                    unitCost: item.unitPrice,
                    reference: sale.saleNumber,
                    userId: sale.createdById,
                    notes: `ขายสินค้า ${sale.saleNumber}`,
                },
            });
        }

        // Update customer points
        if (sale.customerId && sale.totalPoints > 0) {
            await tx.customer.update({
                where: { id: sale.customerId },
                data: {
                    totalPoints: { increment: sale.totalPoints },
                },
            });

            await tx.pointTransaction.create({
                data: {
                    customerId: sale.customerId,
                    points: sale.totalPoints,
                    type: 'EARN',
                    reference: sale.saleNumber,
                },
            });
        }
    });

    revalidatePath('/sales');
}

export async function rejectSale(id: string) {
    await prisma.sale.update({
        where: { id },
        data: { status: 'REJECTED' },
    });
    revalidatePath('/sales');
}

export async function updateSale(id: string, data: {
    customerId?: string | null;
    notes?: string | null;
    billDiscount?: number;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitPrice: number;
        points: number;
        itemDiscount?: number;
    }[];
}) {
    const existing = await prisma.sale.findUnique({
        where: { id },
        include: { items: true },
    });
    if (!existing) throw new Error('ไม่พบรายการขาย');

    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const itemDiscountsTotal = data.items.reduce((s, i) => s + (i.itemDiscount || 0), 0);
    const billDiscount = data.billDiscount || 0;
    const totalDiscount = itemDiscountsTotal + billDiscount;
    const totalAmount = subtotal - totalDiscount;
    const totalPoints = data.items.reduce((s, i) => s + i.points, 0);

    await prisma.$transaction(async (tx) => {
        // If APPROVED, reverse old stock first
        if (existing.status === 'APPROVED') {
            for (const item of existing.items) {
                await tx.productStock.update({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    data: { quantity: { increment: item.quantity } },
                });
            }
            // Remove old stock transactions
            await tx.stockTransaction.deleteMany({
                where: { reference: existing.saleNumber, type: 'SALE' },
            });
        }

        // Delete old items
        await tx.saleItem.deleteMany({ where: { saleId: id } });

        // Update sale header + create new items
        await tx.sale.update({
            where: { id },
            data: {
                customerId: data.customerId || null,
                notes: data.notes !== undefined ? data.notes : undefined,
                totalAmount,
                totalPoints,
                discount: totalDiscount,
                items: {
                    create: data.items.map(i => ({
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        totalPrice: i.quantity * i.unitPrice,
                        discount: i.itemDiscount || 0,
                        points: i.points,
                    })),
                },
            },
        });

        // If APPROVED, deduct new stock
        if (existing.status === 'APPROVED') {
            for (const item of data.items) {
                await tx.productStock.update({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    data: { quantity: { decrement: item.quantity } },
                });
                await tx.stockTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: 'SALE',
                        quantity: -item.quantity,
                        unitCost: item.unitPrice,
                        reference: existing.saleNumber,
                        userId: existing.createdById,
                        notes: `ขายสินค้า ${existing.saleNumber} (แก้ไข)`,
                    },
                });
            }
        }
    });

    // Return updated sale data directly so client doesn't need a second fetch
    const updated = await prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true, productUnits: { select: { unitName: true, conversionRate: true } } } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    revalidatePath('/sales');

    return updated;
}

export async function cancelSale(id: string) {
    const sale = await prisma.sale.findUnique({
        where: { id },
        include: { items: true },
    });
    if (!sale) throw new Error('ไม่พบรายการ');
    if (sale.status === 'CANCELLED') throw new Error('บิลนี้ถูกยกเลิกแล้ว');

    await prisma.$transaction(async (tx) => {
        // If APPROVED, restore stock and record the cancellation
        if (sale.status === 'APPROVED') {
            // Look up the original SALE stock transactions to get base-unit quantities
            // (POS may sell in ลัง but deducts base-unit qty, e.g. 1 ลัง = 6 แกลลอน)
            const saleStockTxs = await tx.stockTransaction.findMany({
                where: { reference: sale.saleNumber, type: 'SALE' },
            });

            for (const item of sale.items) {
                // Find the matching stock transaction for this product+warehouse
                const matchingTx = saleStockTxs.find(
                    st => st.productId === item.productId && st.warehouseId === item.warehouseId
                );
                // Use the absolute value of the stock transaction quantity (which is in base units)
                // Fallback to item.quantity if no stock transaction found
                const baseQtyToRestore = matchingTx ? Math.abs(matchingTx.quantity) : item.quantity;

                await tx.productStock.update({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    data: { quantity: { increment: baseQtyToRestore } },
                });

                // Create SALE_CANCEL stock transaction (positive qty = stock returned)
                await tx.stockTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: 'SALE_CANCEL',
                        quantity: baseQtyToRestore,
                        unitCost: item.unitPrice,
                        reference: sale.saleNumber,
                        userId: sale.createdById,
                        notes: `ยกเลิกบิล ${sale.saleNumber}`,
                    },
                });
            }
        }
        await tx.sale.update({ where: { id }, data: { status: 'CANCELLED' } });
    });

    revalidatePath('/sales');
}
