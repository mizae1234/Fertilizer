'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getWarehouses() {
    return prisma.warehouse.findMany({
        where: { deletedAt: null },
        include: {
            _count: { select: { productStocks: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function createWarehouse(data: { name: string; location?: string }) {
    const warehouse = await prisma.warehouse.create({
        data: {
            name: data.name,
            location: data.location || null,
        },
    });
    revalidatePath('/warehouses');
    return warehouse;
}

export async function updateWarehouse(id: string, data: { name: string; location?: string; isActive?: boolean }) {
    const warehouse = await prisma.warehouse.update({
        where: { id },
        data: {
            name: data.name,
            location: data.location,
            isActive: data.isActive,
        },
    });
    revalidatePath('/warehouses');
    return warehouse;
}

export async function deleteWarehouse(id: string) {
    await prisma.warehouse.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/warehouses');
}

export async function setMainWarehouse(id: string) {
    await prisma.$transaction([
        prisma.warehouse.updateMany({ where: { isMain: true }, data: { isMain: false } }),
        prisma.warehouse.update({ where: { id }, data: { isMain: true } }),
    ]);
    revalidatePath('/warehouses');
}
