'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getVendors(search = '') {
    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { phone: { contains: search } },
                ],
            }
            : {}),
    };

    return prisma.vendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
}

export async function createVendor(data: {
    name: string;
    phone?: string;
    lineId?: string;
    address?: string;
}) {
    const vendor = await prisma.vendor.create({
        data: {
            name: data.name,
            phone: data.phone || null,
            lineId: data.lineId || null,
            address: data.address || null,
        },
    });

    revalidatePath('/vendors');
    return vendor;
}

export async function updateVendor(id: string, data: {
    name: string;
    phone?: string;
    lineId?: string;
    address?: string;
    isActive?: boolean;
}) {
    const vendor = await prisma.vendor.update({
        where: { id },
        data,
    });

    revalidatePath('/vendors');
    return vendor;
}

export async function deleteVendor(id: string) {
    await prisma.vendor.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/vendors');
}
