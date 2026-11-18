'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';
import { getServerUser } from '@/lib/server-auth';
import { roundQty } from '@/lib/utils';
import {
    getCancelledGrNumbers,
    buildActiveReceiveTxWhere,
    computeWeightedAvgCost,
    pickLatestReceiveCost,
    computeGrBillTotals,
    computeEffectiveGrUnitCost,
} from '@/lib/stock-cost-queries';

async function checkGoodsReceiveAccess(isAdminOnly = false) {
    const user = await getServerUser();
    if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    if (isAdminOnly) {
        if (user.role !== 'ADMIN') throw new Error('ไม่มีสิทธิ์ทำรายการ (ADMIN Only)');
    } else {
        const hasAccess = user.role === 'ADMIN' || user.allowedMenus?.includes('/goods-receive');
        if (!hasAccess) throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    }
    return user;
}

export async function getGoodsReceives(page = 1, status = '') {
    await checkGoodsReceiveAccess(false);
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    };

    const [records, total] = await Promise.all([
        prisma.goodsReceive.findMany({
            where,
            include: {
                vendor: { select: { name: true } },
                createdBy: { select: { name: true } },
                cancelledBy: { select: { name: true } },
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
    await checkGoodsReceiveAccess(false);
    return prisma.goodsReceive.findUnique({
        where: { id },
        include: {
            vendor: { select: { id: true, name: true, phone: true, lineId: true } },
            createdBy: { select: { name: true } },
            cancelledBy: { select: { name: true } },
            items: {
                include: {
                    product: {
                        select: {
                            name: true,
                            code: true,
                            unit: true,
                            costMethod: true,
                            productStocks: {
                                select: { warehouseId: true, quantity: true },
                            },
                        },
                    },
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
    discount?: number;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
        lotNo?: string;
        mfgDate?: string | Date | null;
        expDate?: string | Date | null;
    }[];
    userId: string;
}) {
    await checkGoodsReceiveAccess(false);
    const { discount, netTotalAmount } = computeGrBillTotals(data.items, data.discount);

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
            discount,
            totalAmount: netTotalAmount,
            notes: data.notes,
            createdById: data.userId,
            items: {
                create: data.items.map((item) => {
                    const qty = roundQty(item.quantity);
                    return {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: qty,
                        unitCost: item.unitCost,
                        totalCost: Math.round(qty * item.unitCost * 100) / 100,
                        lotNo: item.lotNo || null,
                        mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                        expDate: item.expDate ? new Date(item.expDate) : null,
                    };
                }),
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
    discount?: number;
    items: {
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number;
        lotNo?: string;
        mfgDate?: string | Date | null;
        expDate?: string | Date | null;
    }[];
}) {
    await checkGoodsReceiveAccess(false);
    const existing = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!existing || existing.status !== 'PENDING') {
        throw new Error('ไม่สามารถแก้ไขรายการที่ไม่ใช่สถานะรออนุมัติ');
    }

    const { discount, netTotalAmount } = computeGrBillTotals(
        data.items,
        data.discount !== undefined ? data.discount : existing.discount
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
                discount,
                totalAmount: netTotalAmount,
                items: {
                    create: data.items.map((item) => {
                        const qty = roundQty(item.quantity);
                        return {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            quantity: qty,
                            unitCost: item.unitCost,
                            totalCost: Math.round(qty * item.unitCost * 100) / 100,
                            lotNo: item.lotNo || null,
                            mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                            expDate: item.expDate ? new Date(item.expDate) : null,
                        };
                    }),
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
                    product: { select: { name: true, code: true, unit: true, costMethod: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });
}

export async function approveGoodsReceive(id: string, costMethodOverrides?: Record<string, string>) {
    const adminUser = await checkGoodsReceiveAccess(true);
    const [gr, dbAdmin] = await Promise.all([
        prisma.goodsReceive.findUnique({
            where: { id },
            include: { items: true },
        }),
        prisma.user.findUnique({
            where: { id: adminUser.userId },
            select: { id: true },
        }),
    ]);

    if (!dbAdmin) {
        throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }
    if (!gr || gr.status !== 'PENDING') {
        throw new Error('ไม่สามารถอนุมัติได้');
    }

    await prisma.$transaction(async (tx) => {
        // Update GR status atomically
        const claimed = await tx.goodsReceive.updateMany({
            where: { id, status: 'PENDING', deletedAt: null },
            data: { status: 'APPROVED' },
        });
        if (claimed.count === 0) {
            throw new Error('สถานะใบรับสินค้าเปลี่ยนแปลงแล้ว กรุณารีเฟรชหน้าจอ');
        }

        // If costMethod overrides provided, apply them to Product records first
        if (costMethodOverrides && Object.keys(costMethodOverrides).length > 0) {
            for (const [productId, method] of Object.entries(costMethodOverrides)) {
                await tx.product.update({
                    where: { id: productId },
                    data: { costMethod: method },
                });
            }
        }

        // Fetch products for costMethod check (AFTER overrides applied)
        const productIds = [...new Set(gr.items.map(i => i.productId))];
        const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, cost: true, costMethod: true, name: true },
        });
        const productMap = Object.fromEntries(products.map(p => [p.id, p]));

        const { discount: billDiscount, discountRatio } = computeGrBillTotals(gr.items, gr.discount);

        // Run stock updates + transaction creates sequentially so duplicate products in the same GR accumulate accurately
        for (const item of gr.items) {
            const existing = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                    },
                },
            });

            const newQty = roundQty(item.quantity);
            const effectiveCost = computeEffectiveGrUnitCost(item.unitCost, discountRatio);
            const roundedEffectiveCost = Math.round(effectiveCost * 100) / 100;

            if (existing) {
                const oldQty = existing.quantity;
                const oldCost = Number(existing.avgCost);
                const totalQty = roundQty(oldQty + newQty);
                const avgCost = oldQty <= 0
                    ? effectiveCost
                    : totalQty > 0
                        ? ((oldQty * oldCost) + (newQty * effectiveCost)) / totalQty
                        : effectiveCost;

                await tx.productStock.update({
                    where: { id: existing.id },
                    data: {
                        quantity: totalQty,
                        avgCost: parseFloat(avgCost.toFixed(2)),
                        lastCost: roundedEffectiveCost > 0 || Number(existing.lastCost) === 0 ? roundedEffectiveCost : existing.lastCost,
                    },
                });
            } else {
                await tx.productStock.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        quantity: newQty,
                        avgCost: roundedEffectiveCost,
                        lastCost: roundedEffectiveCost,
                    },
                });
            }

            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'GOODS_RECEIVE',
                    quantity: newQty,
                    unitCost: roundedEffectiveCost,
                    reference: gr.grNumber,
                    lotNo: item.lotNo || null,
                    userId: dbAdmin.id,
                    notes: billDiscount > 0
                        ? `รับสินค้าจาก GR ${gr.grNumber} (หักส่วนลดท้ายบิลเฉลี่ยแล้ว)`
                        : `รับสินค้าจาก GR ${gr.grNumber}`,
                },
            });

            // If GR item has mfgDate or expDate, update product record
            if (item.mfgDate || item.expDate) {
                const dateUpdates: Record<string, any> = {};
                if (item.mfgDate) dateUpdates.mfgDate = item.mfgDate;
                if (item.expDate) dateUpdates.expDate = item.expDate;
                await tx.product.update({
                    where: { id: item.productId },
                    data: dateUpdates,
                });
            }
        }

        // Update product.cost based on costMethod for each product (aggregating all lines of the same product in this GR)
        for (const productId of productIds) {
            const prod = productMap[productId];
            if (!prod) continue;

            const grItemsForProduct = gr.items.filter(i => i.productId === productId);
            if (grItemsForProduct.length === 0) continue;

            const method = prod.costMethod || 'MANUAL';
            console.log(`[GR APPROVE] Product "${prod.name}" (${productId}): costMethod=${prod.costMethod}, resolved=${method}, cost=${Number(prod.cost)}`);

            const oldCost = Number(prod.cost);
            const totalNewQty = roundQty(grItemsForProduct.reduce((s, i) => s + roundQty(i.quantity), 0));
            const totalNewValue = grItemsForProduct.reduce(
                (s, i) => s + roundQty(i.quantity) * computeEffectiveGrUnitCost(i.unitCost, discountRatio),
                0
            );
            const blendedNewCost = totalNewQty > 0 ? totalNewValue / totalNewQty : 0;

            // For LAST / MANUAL when a GR has both a paid line and a 0-cost freebie line, prefer the last positive-cost line
            const nonZeroItems = grItemsForProduct.filter(i => Number(i.unitCost) > 0);
            const representativeCostItem = nonZeroItems.length > 0
                ? nonZeroItems[nonZeroItems.length - 1]
                : grItemsForProduct[grItemsForProduct.length - 1];
            const representativeNetCost = Math.round(
                computeEffectiveGrUnitCost(representativeCostItem.unitCost, discountRatio) * 100
            ) / 100;
            const discountNote = billDiscount > 0 ? ` [หักส่วนลดท้ายบิล ฿${billDiscount}]` : '';

            if (method === 'AVG') {
                // Get total current stock across all warehouses for this product
                const stockAgg = await tx.productStock.aggregate({
                    where: { productId },
                    _sum: { quantity: true },
                });
                // Stock BEFORE this GR was added (subtract ALL GR qtys for this product we just added above)
                const currentStock = roundQty((stockAgg._sum.quantity ?? 0) - totalNewQty);

                let newAvgCost: number;
                if (currentStock <= 0) {
                    newAvgCost = blendedNewCost;
                } else {
                    newAvgCost = ((currentStock * oldCost) + totalNewValue) / (currentStock + totalNewQty);
                }
                newAvgCost = Math.round(newAvgCost * 100) / 100;

                await tx.product.update({
                    where: { id: productId },
                    data: { cost: parseFloat(newAvgCost.toFixed(2)) },
                });

                await tx.productLog.create({
                    data: {
                        productId,
                        userId: dbAdmin.id,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        oldValue: String(oldCost),
                        newValue: String(parseFloat(newAvgCost.toFixed(2))),
                        details: `อัพเดตต้นทุนเฉลี่ย จาก ฿${oldCost} → ฿${parseFloat(newAvgCost.toFixed(2))} (คงเหลือ ${currentStock} + รับใหม่ ${totalNewQty} @ ทุนสุทธิ ฿${Math.round(blendedNewCost * 100) / 100})${discountNote} (GR ${gr.grNumber})`,
                    },
                });
            } else if (method === 'LAST') {
                const newCost = representativeNetCost;

                await tx.product.update({
                    where: { id: productId },
                    data: { cost: newCost },
                });

                await tx.productLog.create({
                    data: {
                        productId,
                        userId: dbAdmin.id,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        oldValue: String(oldCost),
                        newValue: String(newCost),
                        details: `อัพเดตต้นทุนล่าสุด จาก ฿${oldCost} → ฿${newCost}${discountNote} (GR ${gr.grNumber})`,
                    },
                });
            } else if (method === 'MANUAL') {
                const newCost = representativeNetCost;

                if (newCost !== oldCost) {
                    await tx.product.update({
                        where: { id: productId },
                        data: { cost: newCost },
                    });

                    await tx.productLog.create({
                        data: {
                            productId,
                            userId: dbAdmin.id,
                            action: 'COST_UPDATE',
                            field: 'cost',
                            oldValue: String(oldCost),
                            newValue: String(newCost),
                            details: `อัพเดตต้นทุนกำหนดเอง จาก ฿${oldCost} → ฿${newCost}${discountNote} (GR ${gr.grNumber})`,
                        },
                    });
                }
            }
        }
    });

    revalidatePath('/goods-receive');
    revalidatePath(`/goods-receive/${id}`);
    revalidatePath('/products');
}

export async function cancelGoodsReceive(id: string, reason: string) {
    const adminUser = await checkGoodsReceiveAccess(true);
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
        throw new Error('กรุณาระบุเหตุผลการยกเลิกใบรับสินค้า');
    }

    const dbAdmin = await prisma.user.findUnique({
        where: { id: adminUser.userId },
        select: { id: true },
    });
    if (!dbAdmin) {
        throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    }

    await prisma.$transaction(async (tx) => {
        const gr = await tx.goodsReceive.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!gr || gr.deletedAt) {
            throw new Error('ไม่พบรายการใบรับสินค้า');
        }
        if (gr.status === 'CANCELLED') {
            throw new Error('ใบรับสินค้านี้ถูกยกเลิกไปแล้ว');
        }
        if (gr.status !== 'APPROVED') {
            throw new Error('สามารถยกเลิกได้เฉพาะใบรับสินค้าที่อนุมัติแล้วเท่านั้น');
        }

        // Atomic compare-and-set to prevent concurrent double cancellation
        const claimed = await tx.goodsReceive.updateMany({
            where: { id, status: 'APPROVED', deletedAt: null },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelledById: dbAdmin.id,
                cancelReason: cleanReason,
            },
        });
        if (claimed.count === 0) {
            throw new Error('สถานะใบรับสินค้าเปลี่ยนแปลงแล้ว กรุณารีเฟรชหน้าจอ');
        }

        const productIds = [...new Set(gr.items.map(i => i.productId))];
        const [products, cancelledRefs] = await Promise.all([
            tx.product.findMany({
                where: { id: { in: productIds } },
                select: {
                    id: true,
                    cost: true,
                    costMethod: true,
                    name: true,
                    mfgDate: true,
                    expDate: true,
                },
            }),
            // Includes `gr.grNumber` because status was just updated to 'CANCELLED' above
            getCancelledGrNumbers(tx, productIds),
        ]);
        const productMap = Object.fromEntries(products.map(p => [p.id, p]));

        const { discountRatio: cancelDiscountRatio } = computeGrBillTotals(gr.items, gr.discount);

        // Group stock deductions by (productId, warehouseId) so multi-line items in the same GR deduct atomically
        const whGroups = new Map<
            string,
            { productId: string; warehouseId: string; deductQty: number; deductValue: number }
        >();
        for (const item of gr.items) {
            const key = `${item.productId}_${item.warehouseId}`;
            const itemQty = roundQty(item.quantity);
            const itemValue = itemQty * computeEffectiveGrUnitCost(item.unitCost, cancelDiscountRatio);
            const group = whGroups.get(key);
            if (group) {
                group.deductQty = roundQty(group.deductQty + itemQty);
                group.deductValue += itemValue;
            } else {
                whGroups.set(key, {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    deductQty: itemQty,
                    deductValue: itemValue,
                });
            }
        }

        // 1) Deduct ProductStock per (productId, warehouseId) — supports negative balance seamlessly
        for (const group of whGroups.values()) {
            const existing = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: group.productId,
                        warehouseId: group.warehouseId,
                    },
                },
            });

            const oldQty = existing ? existing.quantity : 0;
            const oldAvgCost = existing ? Number(existing.avgCost) : 0;
            const remainingQty = roundQty(oldQty - group.deductQty);

            const whActiveReceives = await tx.stockTransaction.findMany({
                where: buildActiveReceiveTxWhere({
                    productId: group.productId,
                    warehouseId: group.warehouseId,
                    cancelledRefs,
                }),
                orderBy: { createdAt: 'desc' },
                select: { quantity: true, unitCost: true, reference: true },
            });

            const unmixedWhValue = oldQty * oldAvgCost - group.deductValue;
            let newWhAvgCost: number;
            if (remainingQty > 0 && oldQty > 0 && unmixedWhValue > 0) {
                newWhAvgCost = Math.round((unmixedWhValue / remainingQty) * 100) / 100;
            } else if (whActiveReceives.length > 0) {
                newWhAvgCost = computeWeightedAvgCost(whActiveReceives);
            } else {
                newWhAvgCost = 0;
            }

            const newWhLastCost = whActiveReceives.length > 0
                ? pickLatestReceiveCost(whActiveReceives)
                : 0;

            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: group.productId,
                        warehouseId: group.warehouseId,
                    },
                },
                update: {
                    quantity: remainingQty,
                    avgCost: newWhAvgCost,
                    lastCost: newWhLastCost,
                },
                create: {
                    productId: group.productId,
                    warehouseId: group.warehouseId,
                    quantity: remainingQty,
                    avgCost: newWhAvgCost,
                    lastCost: newWhLastCost,
                },
            });
        }

        // 2) Record 1:1 GOODS_RECEIVE_CANCEL StockTransaction per GR item line
        for (const item of gr.items) {
            const qtyToDeduct = roundQty(item.quantity);
            const roundedNetCost = Math.round(computeEffectiveGrUnitCost(item.unitCost, cancelDiscountRatio) * 100) / 100;
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    type: 'GOODS_RECEIVE_CANCEL',
                    quantity: -qtyToDeduct,
                    unitCost: roundedNetCost,
                    reference: gr.grNumber,
                    lotNo: item.lotNo || null,
                    userId: dbAdmin.id,
                    notes: `ยกเลิกรับสินค้า ${gr.grNumber} (เหตุผล: ${cleanReason})`,
                },
            });
        }

        // 3) Revert Product.cost, mfgDate/expDate, and record ProductLog per unique product
        for (const productId of productIds) {
            const prod = productMap[productId];
            if (!prod) continue;

            const cancelledItemsForProduct = gr.items.filter(i => i.productId === productId);
            if (cancelledItemsForProduct.length === 0) continue;

            const totalCancelledQty = roundQty(
                cancelledItemsForProduct.reduce((s, i) => s + roundQty(i.quantity), 0)
            );
            const totalCancelledValue = cancelledItemsForProduct.reduce(
                (s, i) => s + roundQty(i.quantity) * computeEffectiveGrUnitCost(i.unitCost, cancelDiscountRatio),
                0
            );

            const [activeReceives, approvalCostLog, latestCostLog, stockAfterAgg] = await Promise.all([
                tx.stockTransaction.findMany({
                    where: buildActiveReceiveTxWhere({ productId, cancelledRefs }),
                    orderBy: { createdAt: 'desc' },
                    select: { quantity: true, unitCost: true, reference: true },
                }),
                tx.productLog.findFirst({
                    where: {
                        productId,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        details: { contains: `(GR ${gr.grNumber})` },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                tx.productLog.findFirst({
                    where: { productId, action: 'COST_UPDATE', field: 'cost' },
                    orderBy: { createdAt: 'desc' },
                }),
                tx.productStock.aggregate({
                    where: { productId },
                    _sum: { quantity: true },
                }),
            ]);

            const oldCost = Number(prod.cost);
            const wasLatestCostFromThisGr =
                approvalCostLog !== null &&
                latestCostLog?.id === approvalCostLog.id &&
                approvalCostLog.oldValue !== null;

            let revertedCost = oldCost;
            if (wasLatestCostFromThisGr) {
                const parsedPrior = Number(approvalCostLog.oldValue);
                if (Number.isFinite(parsedPrior) && parsedPrior >= 0) {
                    revertedCost = Math.round(parsedPrior * 100) / 100;
                }
            } else {
                const method = prod.costMethod || 'MANUAL';
                if (method === 'LAST') {
                    revertedCost = activeReceives.length > 0
                        ? pickLatestReceiveCost(activeReceives)
                        : oldCost;
                } else if (method === 'AVG') {
                    const stockAfter = roundQty(stockAfterAgg._sum.quantity ?? 0);
                    const stockBeforeCancel = roundQty(stockAfter + totalCancelledQty);
                    const unmixedValue = stockBeforeCancel * oldCost - totalCancelledValue;
                    if (stockAfter > 0 && stockBeforeCancel > 0 && unmixedValue > 0) {
                        revertedCost = Math.round((unmixedValue / stockAfter) * 100) / 100;
                    } else if (activeReceives.length > 0) {
                        revertedCost = computeWeightedAvgCost(activeReceives);
                    }
                }
            }

            // Revert mfgDate / expDate if this GR had set them
            const hadMfgInCancelledGr = cancelledItemsForProduct.some(i => i.mfgDate !== null);
            const hadExpInCancelledGr = cancelledItemsForProduct.some(i => i.expDate !== null);
            const productUpdates: Record<string, unknown> = {};

            if (revertedCost !== oldCost) {
                productUpdates.cost = revertedCost;
            }

            if (hadMfgInCancelledGr) {
                const latestMfgItem = await tx.goodsReceiveItem.findFirst({
                    where: {
                        productId,
                        mfgDate: { not: null },
                        goodsReceive: { status: 'APPROVED', deletedAt: null },
                    },
                    orderBy: [
                        { goodsReceive: { receivedDate: 'desc' } },
                        { goodsReceive: { createdAt: 'desc' } },
                    ],
                    select: { mfgDate: true },
                });
                productUpdates.mfgDate = latestMfgItem?.mfgDate ?? null;
            }

            if (hadExpInCancelledGr) {
                const latestExpItem = await tx.goodsReceiveItem.findFirst({
                    where: {
                        productId,
                        expDate: { not: null },
                        goodsReceive: { status: 'APPROVED', deletedAt: null },
                    },
                    orderBy: [
                        { goodsReceive: { receivedDate: 'desc' } },
                        { goodsReceive: { createdAt: 'desc' } },
                    ],
                    select: { expDate: true },
                });
                productUpdates.expDate = latestExpItem?.expDate ?? null;
            }

            if (Object.keys(productUpdates).length > 0) {
                await tx.product.update({
                    where: { id: productId },
                    data: productUpdates,
                });
            }

            if (revertedCost !== oldCost) {
                await tx.productLog.create({
                    data: {
                        productId,
                        userId: dbAdmin.id,
                        action: 'COST_UPDATE',
                        field: 'cost',
                        oldValue: String(oldCost),
                        newValue: String(revertedCost),
                        details: `ปรับต้นทุนกลับจากการยกเลิกใบรับสินค้า ${gr.grNumber} จาก ฿${oldCost} → ฿${revertedCost} (หักสต็อกคืน -${totalCancelledQty}) เหตุผล: ${cleanReason}`,
                    },
                });
            }

            // If a warehouse's ProductStock had no remaining active receives, align its fallback avgCost with revertedCost
            for (const group of whGroups.values()) {
                if (group.productId !== productId) continue;
                const ps = await tx.productStock.findUnique({
                    where: {
                        productId_warehouseId: {
                            productId: group.productId,
                            warehouseId: group.warehouseId,
                        },
                    },
                });
                if (ps && Number(ps.avgCost) === 0 && revertedCost > 0) {
                    await tx.productStock.update({
                        where: { id: ps.id },
                        data: { avgCost: revertedCost },
                    });
                }
            }
        }
    });

    revalidatePath('/goods-receive');
    revalidatePath(`/goods-receive/${id}`);
    revalidatePath('/products');

    return getGoodsReceiveDetail(id);
}

export async function rejectGoodsReceive(id: string) {
    await checkGoodsReceiveAccess(true);
    const existing = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!existing || existing.status !== 'PENDING') {
        throw new Error('สามารถปฏิเสธได้เฉพาะรายการที่รออนุมัติเท่านั้น');
    }
    await prisma.goodsReceive.update({
        where: { id },
        data: { status: 'REJECTED' },
    });
    revalidatePath('/goods-receive');
    revalidatePath(`/goods-receive/${id}`);
}

export async function deleteGoodsReceive(id: string) {
    await checkGoodsReceiveAccess(false);
    const gr = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!gr) throw new Error('ไม่พบรายการ');
    if (gr.status === 'APPROVED' || gr.status === 'CANCELLED') {
        throw new Error('ไม่สามารถลบรายการที่อนุมัติหรือยกเลิกแล้วได้');
    }

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
    unloadingPaid: boolean;
    unloadingCost: number;
}) {
    await checkGoodsReceiveAccess(true);
    const gr = await prisma.goodsReceive.findUnique({ where: { id } });
    if (!gr) throw new Error('ไม่พบรายการ');
    if (gr.status === 'CANCELLED') {
        throw new Error('ไม่สามารถแก้ไขสถานะการจ่ายเงินของรายการที่ยกเลิกแล้วได้');
    }

    await prisma.goodsReceive.update({
        where: { id },
        data: {
            goodsPaid: data.goodsPaid,
            shippingPaid: data.shippingPaid,
            shippingCost: data.shippingCost,
            unloadingPaid: data.unloadingPaid,
            unloadingCost: data.unloadingCost,
        },
    });

    revalidatePath('/goods-receive');
    revalidatePath(`/goods-receive/${id}`);
}
