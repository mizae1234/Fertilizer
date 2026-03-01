'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function createSaleReturn(data: {
    saleId: string;
    reason?: string;
    userId: string;
    items: {
        saleItemId: string;
        productId: string;
        warehouseId: string;
        quantity: number;
        unitPrice: number;
    }[];
}) {
    if (!data.userId) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    if (!data.items.length) throw new Error('กรุณาเลือกสินค้าที่ต้องการคืน');

    // Validate sale exists and is APPROVED
    const sale = await prisma.sale.findUnique({
        where: { id: data.saleId },
        include: {
            items: true,
            saleReturns: { include: { items: true } },
        },
    });
    if (!sale) throw new Error('ไม่พบบิลขาย');
    if (sale.status !== 'APPROVED') throw new Error('สามารถคืนสินค้าได้เฉพาะบิลที่อนุมัติแล้ว');

    // Calculate already-returned quantities per saleItem
    const returnedMap = new Map<string, number>();
    for (const sr of sale.saleReturns) {
        for (const ri of sr.items) {
            returnedMap.set(ri.saleItemId, (returnedMap.get(ri.saleItemId) || 0) + ri.quantity);
        }
    }

    // Validate return quantities
    for (const item of data.items) {
        if (item.quantity <= 0) throw new Error('จำนวนคืนต้องมากกว่า 0');
        const saleItem = sale.items.find(si => si.id === item.saleItemId);
        if (!saleItem) throw new Error('ไม่พบรายการสินค้าในบิล');
        const alreadyReturned = returnedMap.get(item.saleItemId) || 0;
        const maxReturnable = saleItem.quantity - alreadyReturned;
        if (item.quantity > maxReturnable) {
            throw new Error(`สินค้าคืนได้อีกสูงสุด ${maxReturnable} ชิ้น (คืนไปแล้ว ${alreadyReturned})`);
        }
    }

    const totalAmount = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    // Retry on unique collision
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const returnNumber = await generateNumber('RT');
        try {
            const saleReturn = await prisma.$transaction(async (tx) => {
                // Create sale return
                const newReturn = await tx.saleReturn.create({
                    data: {
                        returnNumber,
                        saleId: data.saleId,
                        reason: data.reason || null,
                        totalAmount,
                        createdById: data.userId,
                        items: {
                            create: data.items.map(i => ({
                                saleItemId: i.saleItemId,
                                productId: i.productId,
                                warehouseId: i.warehouseId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                totalPrice: i.quantity * i.unitPrice,
                            })),
                        },
                    },
                });

                // Restore stock + create StockTransaction for each item
                await Promise.all(data.items.map(async (item) => {
                    await tx.productStock.upsert({
                        where: {
                            productId_warehouseId: {
                                productId: item.productId,
                                warehouseId: item.warehouseId,
                            },
                        },
                        update: { quantity: { increment: item.quantity } },
                        create: {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            quantity: item.quantity,
                        },
                    });

                    await tx.stockTransaction.create({
                        data: {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            type: 'SALE_RETURN',
                            quantity: item.quantity,
                            unitCost: item.unitPrice,
                            reference: returnNumber,
                            userId: data.userId,
                            notes: `คืนสินค้า ${returnNumber} (จากบิล ${sale.saleNumber})`,
                        },
                    });
                }));

                // Create audit log
                await tx.saleEditLog.create({
                    data: {
                        saleId: data.saleId,
                        userId: data.userId,
                        action: 'RETURN',
                        changes: {
                            returnNumber,
                            reason: data.reason || null,
                            totalAmount,
                            items: data.items.map(i => ({
                                productId: i.productId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                            })),
                        },
                    },
                });

                // Deduct totalAmount and totalPoints from the sale
                const returnPoints = data.items.reduce((sum, ri) => {
                    const saleItem = sale.items.find(si => si.id === ri.saleItemId);
                    if (!saleItem || saleItem.quantity === 0) return sum;
                    // Proportional points: (returnQty / saleItemQty) * saleItemPoints
                    return sum + Math.round((ri.quantity / saleItem.quantity) * Number(saleItem.points));
                }, 0);

                await tx.sale.update({
                    where: { id: data.saleId },
                    data: {
                        totalAmount: { decrement: totalAmount },
                        totalPoints: { decrement: returnPoints },
                    },
                });

                // Deduct points from customer if applicable
                if (sale.customerId && returnPoints > 0) {
                    await tx.customer.update({
                        where: { id: sale.customerId },
                        data: { totalPoints: { decrement: returnPoints } },
                    });
                }

                return newReturn;
            });

            revalidatePath('/sales');
            return { id: saleReturn.id, returnNumber: saleReturn.returnNumber };
        } catch (e: any) {
            if (e.message?.includes('Unique constraint') && attempt < 2) {
                lastError = e;
                continue;
            }
            throw e;
        }
    }
    throw lastError || new Error('ไม่สามารถสร้างใบคืนสินค้าได้ กรุณาลองใหม่');
}

export async function getSaleReturns(saleId: string) {
    return prisma.saleReturn.findMany({
        where: { saleId },
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
    });
}
