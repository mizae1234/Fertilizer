'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/utils';

export async function createSaleFromPOS(data: {
    customerId?: string;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitPrice: number;
        points: number;
        conversionRate?: number;
    }[];
    userId: string;
    payments: { method: string; amount: number; dueDate?: string }[];
    notes?: string;
}) {
    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
        throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }

    const totalAmount = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
    );

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
    const saleNumber = generateNumber('SL');

    const sale = await prisma.$transaction(async (tx) => {
        const newSale = await tx.sale.create({
            data: {
                saleNumber,
                customerId: data.customerId || null,
                status: 'APPROVED',
                totalAmount,
                totalPoints,
                paymentMethod,
                creditDueDate: creditPayment?.dueDate ? new Date(creditPayment.dueDate) : null,
                payments: data.payments as any,
                notes: data.notes || null,
                createdById: data.userId,
                items: {
                    create: data.items.map((item) => ({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                        points: item.points,
                    })),
                },
            },
        });

        // Deduct stock + create stock transactions
        for (const item of data.items) {
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
                    unitCost: item.unitPrice,
                    reference: saleNumber,
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

    revalidatePath('/sales');
    return sale;
}
