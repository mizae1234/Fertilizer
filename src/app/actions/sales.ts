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
            saleReturns: {
                include: {
                    createdBy: { select: { name: true } },
                    items: {
                        include: {
                            product: { select: { name: true, code: true, unit: true } },
                            warehouse: { select: { name: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
            saleEditLogs: {
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
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

    // Validate stock — batch query instead of N+1
    const stocks = await prisma.productStock.findMany({
        where: {
            OR: sale.items.map(i => ({
                productId: i.productId,
                warehouseId: i.warehouseId,
            })),
        },
    });
    const stockMap = new Map(stocks.map(s => [`${s.productId}_${s.warehouseId}`, s]));

    for (const item of sale.items) {
        const stock = stockMap.get(`${item.productId}_${item.warehouseId}`);
        const stockToDeduct = item.quantity * Number(item.conversionRate || 1);
        if (!stock || stock.quantity < stockToDeduct) {
            throw new Error('สินค้ามี stock ไม่เพียงพอ');
        }
    }

    await prisma.$transaction(async (tx) => {
        // Update sale status
        await tx.sale.update({
            where: { id },
            data: { status: 'APPROVED' },
        });

        // Deduct stock + create stock transactions in parallel
        await Promise.all(sale.items.map(async (item) => {
            const stockToDeduct = item.quantity * Number(item.conversionRate || 1);
            
            await tx.productStock.update({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                data: {
                    quantity: { decrement: stockToDeduct },
                },
            });

            // Create stock transaction (OUT)
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'SALE',
                    quantity: -stockToDeduct,
                    unitCost: item.unitCost,
                    reference: sale.saleNumber,
                    userId: sale.createdById,
                    notes: `ขายสินค้า ${sale.saleNumber}${Number(item.conversionRate || 1) > 1 ? ` (${item.quantity}×${Number(item.conversionRate || 1)} = ${stockToDeduct} base unit)` : ''}`,
                },
            });
        }));

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
    userId: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitPrice: number;
        points: number;
        itemDiscount?: number;
        unitName?: string;
        conversionRate?: number;
    }[];
}) {
    const existing = await prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { product: { select: { name: true, code: true } } } } },
    });
    if (!existing) throw new Error('ไม่พบรายการขาย');

    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const itemDiscountsTotal = data.items.reduce((s, i) => s + (i.itemDiscount || 0), 0);
    const billDiscount = data.billDiscount || 0;
    const totalDiscount = itemDiscountsTotal + billDiscount;
    const totalAmount = subtotal - totalDiscount;
    const totalPoints = data.items.reduce((s, i) => s + i.points, 0);

    // Recalculate payments JSON if totalAmount changed and has credit/split payments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updatedPayments: any[] | undefined;
    const existingPayments = existing.payments as { method: string; amount: number }[] | null;
    if (existingPayments && Array.isArray(existingPayments) && totalAmount !== Number(existing.totalAmount)) {
        const hasCredit = existingPayments.some(p => p.method === 'CREDIT');
        if (hasCredit) {
            // Keep non-credit payments as-is, recalculate credit = newTotal - sumOfNonCredit
            const nonCreditPaid = existingPayments
                .filter(p => p.method !== 'CREDIT')
                .reduce((s, p) => s + Number(p.amount), 0);
            const newCredit = Math.max(0, totalAmount - nonCreditPaid);
            updatedPayments = [
                ...existingPayments.filter(p => p.method !== 'CREDIT'),
                ...(newCredit > 0 ? [{ method: 'CREDIT', amount: newCredit }] : []),
            ];
        } else {
            // No credit involved — recalculate proportionally or just update
            // For CASH/TRANSFER-only, set the single payment to match new total
            if (existingPayments.length === 1) {
                updatedPayments = [{ method: existingPayments[0].method, amount: totalAmount }];
            } else {
                // Multiple non-credit payments: adjust last one to cover the difference
                const allButLast = existingPayments.slice(0, -1);
                const sumAllButLast = allButLast.reduce((s, p) => s + Number(p.amount), 0);
                const lastPayment = { ...existingPayments[existingPayments.length - 1], amount: Math.max(0, totalAmount - sumAllButLast) };
                updatedPayments = [...allButLast, lastPayment];
            }
        }
    }

    // Build audit log snapshot
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changes: Record<string, any> = {};
    if ((data.customerId || null) !== existing.customerId) {
        changes.customerId = { old: existing.customerId, new: data.customerId || null };
    }
    if (data.notes !== undefined && data.notes !== existing.notes) {
        changes.notes = { old: existing.notes, new: data.notes };
    }
    if (totalAmount !== Number(existing.totalAmount)) {
        changes.totalAmount = { old: Number(existing.totalAmount), new: totalAmount };
    }
    if (totalDiscount !== Number(existing.discount)) {
        changes.discount = { old: Number(existing.discount), new: totalDiscount };
    }
    changes.oldItems = existing.items.map(i => ({
        product: i.product.name, qty: i.quantity, price: Number(i.unitPrice),
    }));
    changes.newItems = data.items.map(i => ({
        productId: i.productId, qty: i.quantity, price: i.unitPrice,
    }));

    await prisma.$transaction(async (tx) => {
        // If APPROVED, reverse old stock first
        if (existing.status === 'APPROVED') {
            for (const item of existing.items) {
                const stockToRestore = item.quantity * Number(item.conversionRate || 1);
                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    update: { quantity: { increment: stockToRestore } },
                    create: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: stockToRestore,
                    },
                });
            }
            // Remove old stock transactions
            await tx.stockTransaction.deleteMany({
                where: { reference: existing.saleNumber, type: 'SALE' },
            });
        }

        // Delete old items
        await tx.saleItem.deleteMany({ where: { saleId: id } });

        // Fetch product.cost for each item — product.cost already reflects the user's
        // configured cost type (avg / last / custom) via updateProductCost
        const productCosts = await Promise.all(
            data.items.map(async (i) => {
                const product = await tx.product.findUnique({
                    where: { id: i.productId },
                    select: { cost: true },
                });
                return product ? Number(product.cost) : 0;
            })
        );

        // Update sale header + create new items
        await tx.sale.update({
            where: { id },
            data: {
                customerId: data.customerId || null,
                notes: data.notes !== undefined ? data.notes : undefined,
                totalAmount,
                totalPoints,
                discount: totalDiscount,
                ...(updatedPayments ? { payments: updatedPayments } : {}),
                items: {
                    create: data.items.map((i, idx) => ({
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        unitCost: parseFloat(productCosts[idx].toFixed(2)),
                        totalPrice: i.quantity * i.unitPrice,
                        discount: i.itemDiscount || 0,
                        points: i.points,
                        unitName: i.unitName || null,
                        conversionRate: i.conversionRate || 1,
                    })),
                },
            },
        });

        // If APPROVED, deduct new stock
        if (existing.status === 'APPROVED') {
            for (const item of data.items) {
                const stockToDeduct = item.quantity * (item.conversionRate || 1);
                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    update: { quantity: { decrement: stockToDeduct } },
                    create: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: -stockToDeduct,
                    },
                });
                await tx.stockTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: 'SALE',
                        quantity: -stockToDeduct,
                        unitCost: item.unitPrice,
                        reference: existing.saleNumber,
                        userId: existing.createdById,
                        notes: `ขายสินค้า ${existing.saleNumber} (แก้ไข)${(item.conversionRate || 1) > 1 ? ` (${item.quantity}×${item.conversionRate} = ${stockToDeduct} base unit)` : ''}`,
                    },
                });
            }
        }

        // Create audit log
        await tx.saleEditLog.create({
            data: {
                saleId: id,
                userId: data.userId,
                action: 'UPDATE',
                changes,
            },
        });
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
            saleReturns: {
                include: {
                    createdBy: { select: { name: true } },
                    items: {
                        include: {
                            product: { select: { name: true, code: true, unit: true } },
                            warehouse: { select: { name: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
            saleEditLogs: {
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            },
            debtPayments: {
                select: { id: true, amount: true, method: true, note: true, paidAt: true },
                orderBy: { paidAt: 'desc' },
            },
            debtInterests: {
                select: { id: true, amount: true },
            },
        },
    });

    revalidatePath('/sales');
    revalidatePath('/overdue-bills');
    revalidatePath(`/overdue-bills/${id}`);
    revalidatePath('/products');

    return updated;
}

export async function cancelSale(id: string, userId?: string) {
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
                const baseQtyToRestore = matchingTx ? Math.abs(matchingTx.quantity) : item.quantity * Number(item.conversionRate || 1);

                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    update: { quantity: { increment: baseQtyToRestore } },
                    create: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: baseQtyToRestore,
                    },
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

        // Create audit log
        await tx.saleEditLog.create({
            data: {
                saleId: id,
                userId: userId || sale.createdById,
                action: 'CANCEL',
                changes: {
                    previousStatus: sale.status,
                    totalAmount: Number(sale.totalAmount),
                    items: sale.items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        unitPrice: Number(i.unitPrice),
                    })),
                },
            },
        });
    });

    revalidatePath('/sales');
}
