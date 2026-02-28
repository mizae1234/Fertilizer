'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/utils';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function getTransfers(page = 1, status = '') {
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
    return prisma.stockTransfer.findUnique({
        where: { id },
        include: {
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
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

export async function createTransfer(data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string;
    items: {
        productId: string;
        quantity: number;
    }[];
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
    const payload = verifyToken(token);
    if (!payload) throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');

    const transfer = await prisma.stockTransfer.create({
        data: {
            transferNumber: generateNumber('TF'),
            fromWarehouseId: data.fromWarehouseId,
            toWarehouseId: data.toWarehouseId,
            status: 'PENDING',
            notes: data.notes,
            createdById: payload.userId,
            items: {
                create: data.items.map((item) => ({
                    productId: item.productId,
                    warehouseId: data.fromWarehouseId,
                    quantity: item.quantity,
                })),
            },
        },
    });

    revalidatePath('/transfers');
    return transfer;
}

export async function approveTransfer(id: string) {
    const transfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!transfer || transfer.status !== 'PENDING') {
        throw new Error('ไม่สามารถอนุมัติได้');
    }

    await prisma.$transaction(async (tx) => {
        // Update transfer status
        await tx.stockTransfer.update({
            where: { id },
            data: { status: 'APPROVED' },
        });

        for (const item of transfer.items) {
            // Deduct from source warehouse
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                    },
                },
                update: { quantity: { decrement: item.quantity } },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    quantity: -item.quantity,
                },
            });

            // Add to destination warehouse
            await tx.productStock.upsert({
                where: {
                    productId_warehouseId: {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                    },
                },
                update: { quantity: { increment: item.quantity } },
                create: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    quantity: item.quantity,
                },
            });

            // Create TRANSFER_OUT transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.fromWarehouseId,
                    type: 'TRANSFER_OUT',
                    quantity: -item.quantity,
                    reference: transfer.transferNumber,
                    userId: transfer.createdById,
                    notes: `โอนออกไปยัง ${transfer.toWarehouseId}`,
                },
            });

            // Create TRANSFER_IN transaction
            await tx.stockTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: transfer.toWarehouseId,
                    type: 'TRANSFER_IN',
                    quantity: item.quantity,
                    reference: transfer.transferNumber,
                    userId: transfer.createdById,
                    notes: `รับโอนจาก ${transfer.fromWarehouseId}`,
                },
            });
        }
    });

    revalidatePath('/transfers');
}

export async function rejectTransfer(id: string) {
    await prisma.stockTransfer.update({
        where: { id },
        data: { status: 'REJECTED' },
    });
    revalidatePath('/transfers');
}
