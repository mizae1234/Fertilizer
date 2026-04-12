'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function createSaleFromPOS(data: {
    customerId?: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitPrice: number;
        points: number;
        conversionRate?: number;
        unitName?: string;
        itemDiscount?: number;
    }[];
    userId: string;
    payments: { method: string; amount: number; dueDate?: string }[];
    notes?: string;
    discount?: number;
    cashReceived?: number;
}) {

    if (!data.userId) {
        throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }

    const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
    );
    const itemDiscountsTotal = data.items.reduce(
        (sum, item) => sum + (item.itemDiscount || 0),
        0
    );
    const billDiscount = data.discount || 0;
    const totalAmount = subtotal - itemDiscountsTotal - billDiscount;

    // Validate payments sum
    const paymentSum = data.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentSum - totalAmount) > 0.01) {
        throw new Error(`ยอดชำระไม่ตรง: ยอดรวม ${totalAmount} แต่ชำระ ${paymentSum}`);
    }

    // Validate credit payments have due dates
    const creditPayment = data.payments.find(p => p.method === 'CREDIT');
    if (creditPayment && !creditPayment.dueDate) {
        throw new Error('กรุณาระบุวันครบกำหนดชำระสำหรับเครดิต');
    }

    // Determine paymentMethod label
    const paymentMethod = data.payments.length === 1
        ? data.payments[0].method
        : 'SPLIT';

    const totalPoints = data.items.reduce((sum, item) => sum + item.points, 0);

    // Retry on saleNumber collision
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const saleNumber = await generateNumber('SL');
        try {
            const sale = await prisma.$transaction(async (tx) => {
                // Fetch product.cost for each item — product.cost already reflects the user's
                // configured cost type (avg / last / custom) via updateProductCost
                const productCosts = await Promise.all(
                    data.items.map(async (item) => {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                            select: { cost: true },
                        });
                        return product ? Number(product.cost) : 0;
                    })
                );

                const newSale = await tx.sale.create({
                    data: {
                        saleNumber,
                        customerId: data.customerId || null,
                        status: 'APPROVED',
                        totalAmount,
                        totalPoints,
                        discount: itemDiscountsTotal + billDiscount,
                        paymentMethod,
                        creditDueDate: creditPayment?.dueDate ? new Date(creditPayment.dueDate) : null,
                        payments: data.payments as any,
                        notes: data.notes || null,
                        cashReceived: data.cashReceived || null,
                        createdById: data.userId,
                        items: {
                            create: data.items.map((item, idx) => ({
                                productId: item.productId,
                                warehouseId: item.warehouseId,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                unitCost: parseFloat(productCosts[idx].toFixed(2)),
                                totalPrice: item.quantity * item.unitPrice,
                                discount: item.itemDiscount || 0,
                                points: item.points,
                                unitName: item.unitName || null,
                                conversionRate: item.conversionRate || 1,
                            })),
                        },
                    },
                });

                // Deduct stock + create stock transactions sequentially per item to avoid transaction deadlocks
                for (let idx = 0; idx < data.items.length; idx++) {
                    const item = data.items[idx];
                    const stockToDeduct = item.quantity * (item.conversionRate || 1);
                    
                    await tx.productStock.upsert({
                        where: {
                            productId_warehouseId: {
                                productId: item.productId,
                                warehouseId: item.warehouseId,
                            },
                        },
                        update: {
                            quantity: { decrement: stockToDeduct },
                        },
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
                            unitCost: parseFloat(productCosts[idx].toFixed(2)),
                            reference: saleNumber,
                            userId: data.userId,
                            notes: `ขายสินค้า ${saleNumber}${(item.conversionRate || 1) > 1 ? ` (${item.quantity}×${item.conversionRate} = ${stockToDeduct} base unit)` : ''}`,
                        },
                    });
                }

                // Award customer points
                if (data.customerId && totalPoints > 0) {
                    await tx.customer.update({
                        where: { id: data.customerId },
                        data: { totalPoints: { increment: totalPoints } },
                    });

                    await tx.pointTransaction.create({
                        data: {
                            customerId: data.customerId,
                            points: totalPoints,
                            type: 'EARN',
                            reference: saleNumber,
                        },
                    });
                }

                return newSale;
            });

            // Serialize Decimal values before returning to client
            return { id: sale.id, saleNumber: sale.saleNumber, totalAmount: Number(sale.totalAmount) };
        } catch (e: any) {
            if (e.message?.includes('Unique constraint') && attempt < 2) {
                lastError = e;
                continue;
            }
            throw e;
        }
    }
    throw lastError || new Error('ไม่สามารถสร้างบิลขายได้ กรุณาลองใหม่');
}
