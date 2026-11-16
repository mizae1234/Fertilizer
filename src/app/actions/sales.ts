'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { roundQty } from '@/lib/utils';

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
        const stockToDeduct = roundQty(item.quantity * Number(item.conversionRate || 1));
        if (!stock || stock.quantity + 0.0001 < stockToDeduct) {
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
            const stockToDeduct = roundQty(item.quantity * Number(item.conversionRate || 1));
            const currentStock = stockMap.get(`${item.productId}_${item.warehouseId}`);
            
            await tx.productStock.update({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
                data: {
                    quantity: roundQty((currentStock?.quantity ?? 0) - stockToDeduct),
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
    creditDueDate?: string | null;
    userId: string;
    items: {
        id?: string;
        productId: string;
        warehouseId: string;
        quantity: number; // net remaining quantity (excluding already-returned qty)
        unitPrice: number;
        points: number;
        itemDiscount?: number;
        unitName?: string;
        conversionRate?: number;
    }[];
}) {
    const existing = await prisma.sale.findUnique({
        where: { id },
        include: {
            items: { include: { product: { select: { name: true, code: true } } } },
            saleReturns: { include: { items: true } },
            debtPayments: true,
            debtInterests: true,
        },
    });
    if (!existing) throw new Error('ไม่พบรายการขาย');

    // Map already-returned quantity per original SaleItem.id
    const returnedByItemId = new Map<string, number>();
    for (const sr of existing.saleReturns || []) {
        for (const ri of sr.items) {
            returnedByItemId.set(ri.saleItemId, (returnedByItemId.get(ri.saleItemId) || 0) + ri.quantity);
        }
    }

    // data.items.quantity is the net remaining quantity kept by the customer
    const subtotal = Math.round(data.items.reduce((s, i) => s + roundQty(i.quantity) * i.unitPrice, 0) * 100) / 100;
    const itemDiscountsTotal = Math.round(data.items.reduce((s, i) => s + (i.itemDiscount || 0), 0) * 100) / 100;
    const billDiscount = data.billDiscount || 0;
    const totalDiscount = Math.round((itemDiscountsTotal + billDiscount) * 100) / 100;
    const totalAmount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
    const totalPoints = Math.floor(data.items.reduce((s, i) => s + Math.floor(i.points || 0), 0));

    // Resolve updated creditDueDate
    const nextDueDate: Date | null | undefined =
        data.creditDueDate === undefined
            ? undefined
            : data.creditDueDate
                ? new Date(data.creditDueDate)
                : null;
    const effectiveDueDateIso =
        nextDueDate !== undefined
            ? (nextDueDate ? nextDueDate.toISOString().slice(0, 10) : undefined)
            : (existing.creditDueDate ? existing.creditDueDate.toISOString().slice(0, 10) : undefined);

    // Recalculate payments JSON if totalAmount or creditDueDate changed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updatedPayments: any[] | undefined;
    const existingPayments = existing.payments as { method: string; amount: number; dueDate?: string; bankAccountId?: string; chequeNo?: string }[] | null;
    const hasCreditInPayments = existingPayments && Array.isArray(existingPayments) && existingPayments.some(p => p.method === 'CREDIT');

    if (existingPayments && Array.isArray(existingPayments) && (totalAmount !== Number(existing.totalAmount) || (nextDueDate !== undefined && hasCreditInPayments))) {
        if (hasCreditInPayments) {
            const oldCreditEntry = existingPayments.find(p => p.method === 'CREDIT');
            const nonCreditPaid = existingPayments
                .filter(p => p.method !== 'CREDIT')
                .reduce((s, p) => s + Number(p.amount), 0);
            const newCredit = Math.max(0, Math.round((totalAmount - nonCreditPaid) * 100) / 100);
            const dueToStore = effectiveDueDateIso || oldCreditEntry?.dueDate;
            updatedPayments = [
                ...existingPayments.filter(p => p.method !== 'CREDIT'),
                ...(newCredit > 0 ? [{ method: 'CREDIT', amount: newCredit, ...(dueToStore ? { dueDate: dueToStore } : {}) }] : []),
            ];
        } else {
            if (existingPayments.length === 1) {
                updatedPayments = [{ ...existingPayments[0], amount: totalAmount }];
            } else if (existingPayments.length > 1) {
                const allButLast = existingPayments.slice(0, -1);
                const sumAllButLast = allButLast.reduce((s, p) => s + Number(p.amount), 0);
                const lastPayment = { ...existingPayments[existingPayments.length - 1], amount: Math.max(0, Math.round((totalAmount - sumAllButLast) * 100) / 100) };
                updatedPayments = [...allButLast, lastPayment];
            }
        }
    }

    // Determine if paymentMethod needs to transition between PAID and CREDIT/SPLIT
    let nextPaymentMethod: string | undefined;
    if (hasCreditInPayments || existing.paymentMethod === 'CREDIT' || existing.paymentMethod === 'SPLIT' || existing.paymentMethod === 'PAID') {
        const paymentsForCheck = updatedPayments || existingPayments || [];
        const initialNonCredit = Array.isArray(paymentsForCheck)
            ? paymentsForCheck.filter((p: any) => p.method !== 'CREDIT').reduce((s: number, p: any) => s + Number(p.amount), 0)
            : 0;
        const debtPaid = (existing.debtPayments || [])
            .filter(dp => dp.method !== 'CREDIT')
            .reduce((s, dp) => s + Number(dp.amount), 0);
        const totalInterest = (existing.debtInterests || []).reduce((s, di) => s + Number(di.amount), 0);
        const remainingDebt = totalAmount + totalInterest - (initialNonCredit + debtPaid);
        if (hasCreditInPayments || existing.paymentMethod === 'CREDIT' || existing.paymentMethod === 'SPLIT') {
            if (remainingDebt <= 0.01) {
                nextPaymentMethod = 'PAID';
            } else {
                nextPaymentMethod = initialNonCredit > 0 ? 'SPLIT' : 'CREDIT';
            }
        } else if (existing.paymentMethod === 'PAID' && remainingDebt > 0.01) {
            nextPaymentMethod = initialNonCredit > 0 ? 'SPLIT' : 'CREDIT';
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
    if (nextDueDate !== undefined) {
        const oldDue = existing.creditDueDate ? existing.creditDueDate.toISOString().slice(0, 10) : null;
        const newDue = nextDueDate ? nextDueDate.toISOString().slice(0, 10) : null;
        if (oldDue !== newDue) {
            changes.creditDueDate = { old: oldDue, new: newDue };
        }
    }
    if (totalAmount !== Number(existing.totalAmount)) {
        changes.totalAmount = { old: Number(existing.totalAmount), new: totalAmount };
    }
    if (totalDiscount !== Number(existing.discount)) {
        changes.discount = { old: Number(existing.discount), new: totalDiscount };
    }
    changes.oldItems = existing.items.map(i => ({
        product: i.product.name, qty: Math.max(0, roundQty(i.quantity - (returnedByItemId.get(i.id) || 0))), price: Number(i.unitPrice),
    }));
    changes.newItems = data.items.map(i => ({
        productId: i.productId, qty: roundQty(i.quantity), price: i.unitPrice,
    }));

    await prisma.$transaction(async (tx) => {
        // If APPROVED, reverse old stock first (gross sold qty, since SALE_RETURN txs stay intact)
        if (existing.status === 'APPROVED') {
            for (const item of existing.items) {
                const stockToRestore = roundQty(item.quantity * Number(item.conversionRate || 1));
                const costToUse = Number(item.unitCost);
                const destStock = await tx.productStock.findUnique({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                });
                const currentAvgCost = destStock ? Number(destStock.avgCost) : 0;

                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    update: { 
                        quantity: roundQty((destStock?.quantity ?? 0) + stockToRestore),
                        ...(currentAvgCost === 0 ? { avgCost: costToUse } : {})
                    },
                    create: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: stockToRestore,
                        avgCost: costToUse,
                    },
                });
            }
            // Remove old SALE stock transactions
            await tx.stockTransaction.deleteMany({
                where: { reference: existing.saleNumber, type: 'SALE' },
            });
        }

        // Fetch product.cost for each item
        const productCosts = await Promise.all(
            data.items.map(async (i) => {
                const product = await tx.product.findUnique({
                    where: { id: i.productId },
                    select: { cost: true },
                });
                return product ? Number(product.cost) : 0;
            })
        );

        const incomingIds = new Set(data.items.map(i => i.id).filter(Boolean) as string[]);

        // Delete removed SaleItems ONLY if they have 0 returned quantity;
        // if a removed item had prior returns, keep it with quantity = returnedQty so SaleReturnItem.saleItemId stays intact!
        for (const oldItem of existing.items) {
            if (!incomingIds.has(oldItem.id)) {
                const retQty = roundQty(returnedByItemId.get(oldItem.id) || 0);
                if (retQty > 0) {
                    await tx.saleItem.update({
                        where: { id: oldItem.id },
                        data: {
                            quantity: retQty,
                            totalPrice: Math.round(retQty * Number(oldItem.unitPrice) * 100) / 100,
                            points: 0,
                        },
                    });
                    if (existing.status === 'APPROVED') {
                        const stockForReturned = roundQty(retQty * Number(oldItem.conversionRate || 1));
                        const destStock = await tx.productStock.findUnique({
                            where: { productId_warehouseId: { productId: oldItem.productId, warehouseId: oldItem.warehouseId } },
                        });
                        await tx.productStock.update({
                            where: { productId_warehouseId: { productId: oldItem.productId, warehouseId: oldItem.warehouseId } },
                            data: { quantity: roundQty((destStock?.quantity ?? 0) - stockForReturned) },
                        });
                        await tx.stockTransaction.create({
                            data: {
                                productId: oldItem.productId,
                                warehouseId: oldItem.warehouseId,
                                type: 'SALE',
                                quantity: -stockForReturned,
                                unitCost: Number(oldItem.unitCost),
                                reference: existing.saleNumber,
                                userId: existing.createdById,
                                notes: `ขายสินค้า ${existing.saleNumber} (แก้ไข - รายการคืนแล้ว)`,
                            },
                        });
                    }
                } else {
                    await tx.saleItem.delete({ where: { id: oldItem.id } });
                }
            }
        }

        // Update existing items in-place (preserving SaleItem.id!) and create newly added items
        for (let idx = 0; idx < data.items.length; idx++) {
            const i = data.items[idx];
            const retQty = i.id ? (returnedByItemId.get(i.id) || 0) : 0;
            const grossQty = roundQty(i.quantity + retQty);
            const conv = i.conversionRate || 1;
            const unitCostVal = parseFloat(productCosts[idx].toFixed(2));
            const ptsVal = Math.floor(i.points || 0);

            if (i.id && existing.items.some(old => old.id === i.id)) {
                await tx.saleItem.update({
                    where: { id: i.id },
                    data: {
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        quantity: grossQty,
                        unitPrice: i.unitPrice,
                        unitCost: unitCostVal,
                        totalPrice: Math.round(grossQty * i.unitPrice * 100) / 100,
                        discount: i.itemDiscount || 0,
                        points: ptsVal,
                        unitName: i.unitName || null,
                        conversionRate: conv,
                    },
                });
            } else {
                await tx.saleItem.create({
                    data: {
                        saleId: id,
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        quantity: grossQty,
                        unitPrice: i.unitPrice,
                        unitCost: unitCostVal,
                        totalPrice: Math.round(grossQty * i.unitPrice * 100) / 100,
                        discount: i.itemDiscount || 0,
                        points: ptsVal,
                        unitName: i.unitName || null,
                        conversionRate: conv,
                    },
                });
            }

            if (existing.status === 'APPROVED') {
                const stockToDeduct = roundQty(grossQty * conv);
                const destStock = await tx.productStock.findUnique({
                    where: { productId_warehouseId: { productId: i.productId, warehouseId: i.warehouseId } },
                });
                const currentAvgCost = destStock ? Number(destStock.avgCost) : 0;

                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: i.productId, warehouseId: i.warehouseId } },
                    update: { 
                        quantity: roundQty((destStock?.quantity ?? 0) - stockToDeduct),
                        ...(currentAvgCost === 0 ? { avgCost: unitCostVal } : {})
                    },
                    create: {
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        quantity: -stockToDeduct,
                        avgCost: unitCostVal,
                    },
                });
                await tx.stockTransaction.create({
                    data: {
                        productId: i.productId,
                        warehouseId: i.warehouseId,
                        type: 'SALE',
                        quantity: -stockToDeduct,
                        unitCost: unitCostVal,
                        reference: existing.saleNumber,
                        userId: existing.createdById,
                        notes: `ขายสินค้า ${existing.saleNumber} (แก้ไข)${conv > 1 ? ` (${grossQty}×${conv} = ${stockToDeduct} base unit)` : ''}`,
                    },
                });
            }
        }

        // Update sale header
        await tx.sale.update({
            where: { id },
            data: {
                customerId: data.customerId || null,
                notes: data.notes !== undefined ? data.notes : undefined,
                totalAmount,
                totalPoints,
                discount: totalDiscount,
                ...(nextDueDate !== undefined ? { creditDueDate: nextDueDate } : {}),
                ...(updatedPayments ? { payments: updatedPayments } : {}),
                ...(nextPaymentMethod ? { paymentMethod: nextPaymentMethod } : {}),
            },
        });

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
                select: { id: true, amount: true, method: true, dueDate: true, note: true, bankAccountId: true, paidAt: true },
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
                const baseQtyToRestore = roundQty(matchingTx ? Math.abs(matchingTx.quantity) : item.quantity * Number(item.conversionRate || 1));

                const costToUse = Number(item.unitCost);
                const destStock = await tx.productStock.findUnique({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                });
                const currentAvgCost = destStock ? Number(destStock.avgCost) : 0;

                await tx.productStock.upsert({
                    where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
                    update: { 
                        quantity: roundQty((destStock?.quantity ?? 0) + baseQtyToRestore),
                        ...(currentAvgCost === 0 ? { avgCost: costToUse } : {})
                    },
                    create: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: baseQtyToRestore,
                        avgCost: costToUse,
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
    revalidatePath(`/sales/${id}`);
    revalidatePath('/overdue-bills');
    revalidatePath(`/overdue-bills/${id}`);
    revalidatePath('/reports');
    revalidatePath('/products');
}
