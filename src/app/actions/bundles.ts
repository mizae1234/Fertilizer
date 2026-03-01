'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';


export async function getBundles(page = 1, search = '') {
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { code: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {}),
    };

    const [bundles, total] = await Promise.all([
        prisma.productBundle.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, code: true, price: true, cost: true, unit: true },
                        },
                    },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.productBundle.count({ where }),
    ]);

    return { bundles, totalPages: Math.ceil(total / perPage) };
}

export async function getBundleDetail(id: string) {
    return prisma.productBundle.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: {
                        select: { id: true, name: true, code: true, price: true, cost: true, unit: true },
                    },
                },
            },
        },
    });
}

export async function createBundle(data: {
    name: string;
    description?: string;
    bundlePrice: number;
    bundleCost: number;
    items: { productId: string; quantity: number }[];
}) {
    // Robust code generation with retry on unique constraint
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            // Count ALL bundles (including soft-deleted) to get next number
            const allBundles = await prisma.productBundle.findMany({
                select: { code: true },
                orderBy: { code: 'desc' },
                take: 1,
            });
            const lastNum = allBundles.length > 0 ? parseInt(allBundles[0].code.replace('BD', '')) || 0 : 0;
            const code = 'BD' + String(lastNum + 1 + attempt).padStart(4, '0');

            const bundle = await prisma.productBundle.create({
                data: {
                    code,
                    name: data.name,
                    description: data.description || null,
                    bundlePrice: data.bundlePrice,
                    bundleCost: data.bundleCost,
                    items: {
                        create: data.items.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                        })),
                    },
                },
            });
            revalidatePath('/bundles');
            return bundle;
        } catch (e: any) {
            // If it's NOT a unique constraint error, throw immediately
            if (!e.message?.includes('Unique constraint')) throw e;
            // Otherwise retry with next number
            if (attempt === maxAttempts - 1) throw new Error('ไม่สามารถสร้างรหัสชุดสินค้าได้ กรุณาลองใหม่อีกครั้ง');
        }
    }
}

export async function updateBundle(
    id: string,
    data: {
        name: string;
        description?: string;
        bundlePrice: number;
        bundleCost: number;
        items: { productId: string; quantity: number }[];
    }
) {
    await prisma.$transaction(async (tx) => {
        await tx.productBundle.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description || null,
                bundlePrice: data.bundlePrice,
                bundleCost: data.bundleCost,
            },
        });

        // Replace all items
        await tx.productBundleItem.deleteMany({ where: { bundleId: id } });
        await tx.productBundleItem.createMany({
            data: data.items.map((item) => ({
                bundleId: id,
                productId: item.productId,
                quantity: item.quantity,
            })),
        });
    });

    revalidatePath('/bundles');
}

export async function deleteBundle(id: string) {
    await prisma.productBundle.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/bundles');
}

// Get all active bundles for POS
export async function getActiveBundles() {
    return prisma.productBundle.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
            items: {
                include: {
                    product: {
                        select: { id: true, name: true, code: true, price: true, unit: true },
                    },
                },
            },
        },
        orderBy: { name: 'asc' },
    });
}
