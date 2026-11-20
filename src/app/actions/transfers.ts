'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';
import { getServerUser } from '@/lib/server-auth';
import { roundQty } from '@/lib/utils';

async function requireAuthenticatedUser() {
    const user = await getServerUser();
    if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const dbUser = await prisma.user.findFirst({
        where: { id: user.userId, deletedAt: null },
        select: { id: true, name: true, role: true },
    });
    if (!dbUser) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    return dbUser;
}

async function requireAdminUser() {
    const user = await getServerUser();
    if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    if (user.role !== 'ADMIN') {
        throw new Error('ไม่มีสิทธิ์ทำรายการ (เฉพาะผู้ดูแลระบบ ADMIN เท่านั้น)');
    }
    const dbAdmin = await prisma.user.findFirst({
        where: { id: user.userId, deletedAt: null, role: 'ADMIN' },
        select: { id: true, name: true },
    });
    if (!dbAdmin) {
        throw new Error('ไม่มีสิทธิ์ทำรายการ (เฉพาะผู้ดูแลระบบ ADMIN เท่านั้น)');
    }
    return dbAdmin;
}

export async function getTransfers(page = 1, status = '') {
    await requireAuthenticatedUser();
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    };

    const [transfers, total] = await Promise.all([
        prisma.stockTransfer.findMany({
            where,
            include: {
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
                createdBy: { select: { name: true } },
                cancelledBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.stockTransfer.count({ where }),
    ]);

    return { transfers, totalPages: Math.ceil(total / perPage) };
}

export async function getTransferDetail(id: string) {
    await requireAuthenticatedUser();
    return prisma.stockTransfer.findFirst({
        where: { id, deletedAt: null },
        include: {
            fromWarehouse: { select: { id: true, name: true } },
            toWarehouse: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
            cancelledBy: { select: { name: true } },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            unit: true,
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

export async function createTransfer(data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string;
    items: {
        productId: string;
        quantity: number;
    }[];
}) {
    const dbUser = await requireAuthenticatedUser();

    if (!data.fromWarehouseId || !data.toWarehouseId) {
        throw new Error('กรุณาเลือกคลังต้นทางและคลังปลายทาง');
    }
    if (data.fromWarehouseId === data.toWarehouseId) {
        throw new Error('คลังต้นทางและคลังปลายทางต้องต่างกัน');
    }
    if (!data.items || data.items.length === 0) {
        throw new Error('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    }
    if (data.items.some((item) => !item.productId || roundQty(item.quantity) <= 0)) {
        throw new Error('กรุณาเลือกสินค้าและระบุจำนวนที่มากกว่า 0 ให้ครบทุกรายการ');
    }

    const transfer = await prisma.stockTransfer.create({
        data: {
            transferNumber: await generateNumber('TF'),
            fromWarehouseId: data.fromWarehouseId,
            toWarehouseId: data.toWarehouseId,
            status: 'PENDING',
            notes: data.notes?.trim() || null,
            createdById: dbUser.id,
            items: {
                create: data.items.map((item) => ({
                    productId: item.productId,
                    warehouseId: data.fromWarehouseId,
                    quantity: roundQty(item.quantity),
                })),
            },
        },
    });

    revalidatePath('/transfers');
    return transfer;
}

export async function approveTransfer(id: string) {
    const dbAdmin = await requireAdminUser();

    await prisma.$transaction(async (tx) => {
        const transfer = await tx.stockTransfer.findUnique({
            where: { id },
            include: {
                items: true,
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
            },
        });

        if (!transfer || transfer.deletedAt) {
            throw new Error('ไม่พบเอกสารโอนสินค้า');
        }
        if (transfer.status !== 'PENDING') {
            throw new Error('ไม่สามารถอนุมัติได้ (เฉพาะใบโอนที่รออนุมัติเท่านั้น)');
        }

        // Atomic compare-and-set to prevent duplicate concurrent approvals
        const updated = await tx.stockTransfer.updateMany({
            where: { id, status: 'PENDING', deletedAt: null },
            data: { status: 'APPROVED' },
        });
        if (updated.count === 0) {
            throw new Error('ไม่สามารถอนุมัติได้ (สถานะเอกสารเปลี่ยนไปแล้ว)');
        }

        // Process sequentially so duplicate product rows in the same transfer accumulate accurately
        for (const item of transfer.items) {
            const qty = roundQty(item.quantity);
            if (qty <= 0) continue;

            // Get source stock to retrieve its avgCost or product cost fallback
            const sourceStock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                    },
                },
                include: { product: { select: { cost: true } } },
            });
            const currentAvgCost = sourceStock ? Number(sourceStock.avgCost) : 0;
            const fallbackCost = sourceStock?.product?.cost ? Number(sourceStock.product.cost) : 0;
            const costToUse = currentAvgCost > 0 ? currentAvgCost : fallbackCost;

            // Deduct from source warehouse
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                    },
                },
                update: { quantity: roundQty((sourceStock?.quantity ?? 0) - qty) },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    quantity: -qty,
                    avgCost: costToUse,
                },
            });

            // Add to destination warehouse
            const destStock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                    },
                },
            });
            const destAvgCost = destStock ? Number(destStock.avgCost) : 0;

            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                    },
                },
                update: {
                    quantity: roundQty((destStock?.quantity ?? 0) + qty),
                    ...(destAvgCost === 0 && costToUse > 0 ? { avgCost: costToUse } : {}),
                },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    quantity: qty,
                    avgCost: costToUse,
                },
            });

            // Create TRANSFER_OUT transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    type: 'TRANSFER_OUT',
                    quantity: -qty,
                    unitCost: costToUse,
                    reference: transfer.transferNumber,
                    userId: dbAdmin.id,
                    notes: `โอนออกไปยังคลัง ${transfer.toWarehouse.name}`,
                },
            });

            // Create TRANSFER_IN transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    type: 'TRANSFER_IN',
                    quantity: qty,
                    unitCost: costToUse,
                    reference: transfer.transferNumber,
                    userId: dbAdmin.id,
                    notes: `รับโอนจากคลัง ${transfer.fromWarehouse.name}`,
                },
            });
        }
    });

    revalidatePath('/transfers');
    revalidatePath(`/transfers/${id}`);
    revalidatePath('/products');
}

export async function rejectTransfer(id: string) {
    await requireAdminUser();

    const updated = await prisma.stockTransfer.updateMany({
        where: { id, status: 'PENDING', deletedAt: null },
        data: { status: 'REJECTED' },
    });
    if (updated.count === 0) {
        throw new Error('ไม่สามารถปฏิเสธได้ (เฉพาะใบโอนที่รออนุมัติเท่านั้น)');
    }

    revalidatePath('/transfers');
    revalidatePath(`/transfers/${id}`);
}

export async function cancelTransfer(id: string, reason: string) {
    const dbAdmin = await requireAdminUser();
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
        throw new Error('กรุณาระบุเหตุผลการยกเลิกใบโอนสินค้า');
    }

    await prisma.$transaction(async (tx) => {
        const transfer = await tx.stockTransfer.findUnique({
            where: { id },
            include: {
                items: true,
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
            },
        });

        if (!transfer || transfer.deletedAt) {
            throw new Error('ไม่พบเอกสารโอนสินค้า');
        }
        if (transfer.status === 'CANCELLED') {
            throw new Error('ใบโอนสินค้านี้ถูกยกเลิกไปแล้ว');
        }
        if (transfer.status !== 'APPROVED') {
            throw new Error('สามารถยกเลิกและคืนสต็อกได้เฉพาะใบโอนที่อนุมัติแล้วเท่านั้น');
        }

        // Atomic compare-and-set to prevent concurrent double cancellation
        const updated = await tx.stockTransfer.updateMany({
            where: { id, status: 'APPROVED', deletedAt: null },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelledById: dbAdmin.id,
                cancelReason: cleanReason,
            },
        });
        if (updated.count === 0) {
            throw new Error('ไม่สามารถยกเลิกใบโอนนี้ได้ (สถานะเอกสารอาจเปลี่ยนไปแล้ว)');
        }

        // Lookup original transfer stock transactions to preserve historical unitCost if recorded
        const originalTxs = await tx.stockTransaction.findMany({
            where: {
                reference: transfer.transferNumber,
                type: { in: ['TRANSFER_OUT', 'TRANSFER_IN'] },
            },
            select: { productId: true, unitCost: true },
        });
        const txCostByProduct = new Map<string, number>();
        for (const otx of originalTxs) {
            const c = Number(otx.unitCost);
            if (c > 0 && !txCostByProduct.has(otx.productId)) {
                txCostByProduct.set(otx.productId, c);
            }
        }

        // Reverse stock movement sequentially per item:
        // 1) Deduct transferred quantity from destination warehouse (toWarehouseId)
        // 2) Return transferred quantity back to source warehouse (fromWarehouseId)
        // 3) Log paired TRANSFER_CANCEL StockTransaction entries for Stock Card audit trail
        for (const item of transfer.items) {
            const qty = roundQty(item.quantity);
            if (qty <= 0) continue;

            const destStock = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                    },
                },
                include: { product: { select: { cost: true } } },
            });

            const sourceStockBefore = await tx.productStock.findUnique({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                    },
                },
                include: { product: { select: { cost: true } } },
            });

            const txCost = txCostByProduct.get(item.productId) ?? 0;
            const destAvgCost = destStock ? Number(destStock.avgCost) : 0;
            const sourceAvgCost = sourceStockBefore ? Number(sourceStockBefore.avgCost) : 0;
            const fallbackProductCost = Number(
                destStock?.product?.cost ?? sourceStockBefore?.product?.cost ?? 0
            );
            const costToUse = txCost > 0
                ? txCost
                : (sourceAvgCost > 0 ? sourceAvgCost : (destAvgCost > 0 ? destAvgCost : fallbackProductCost));

            // 1. Deduct from destination warehouse (supports negative stock if already sold)
            const newDestQty = roundQty((destStock?.quantity ?? 0) - qty);
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                    },
                },
                update: { quantity: newDestQty },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    quantity: -qty,
                    avgCost: costToUse,
                },
            });

            // 2. Return back to source warehouse
            const baseSourceQty = transfer.fromWarehouseId === transfer.toWarehouseId
                ? newDestQty
                : (sourceStockBefore?.quantity ?? 0);
            const newSourceQty = roundQty(baseSourceQty + qty);

            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                    },
                },
                update: {
                    quantity: newSourceQty,
                    ...(sourceAvgCost === 0 && costToUse > 0 ? { avgCost: costToUse } : {}),
                },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    quantity: qty,
                    avgCost: costToUse,
                },
            });

            // 3a. Audit log on destination warehouse (stock out)
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    type: 'TRANSFER_CANCEL',
                    quantity: -qty,
                    unitCost: costToUse,
                    reference: transfer.transferNumber,
                    userId: dbAdmin.id,
                    notes: `ยกเลิกใบโอน ${transfer.transferNumber} คืนสต็อกกลับคลัง ${transfer.fromWarehouse.name} (เหตุผล: ${cleanReason})`,
                },
            });

            // 3b. Audit log on source warehouse (stock returned in)
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    type: 'TRANSFER_CANCEL',
                    quantity: qty,
                    unitCost: costToUse,
                    reference: transfer.transferNumber,
                    userId: dbAdmin.id,
                    notes: `รับคืนสต็อกจากยกเลิกใบโอน ${transfer.transferNumber} จากคลัง ${transfer.toWarehouse.name} (เหตุผล: ${cleanReason})`,
                },
            });
        }
    });

    revalidatePath('/transfers');
    revalidatePath(`/transfers/${id}`);
    revalidatePath('/products');
}
