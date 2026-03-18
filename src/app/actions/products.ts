'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getProducts(page = 1, search = '') {
    const perPage = 10;
    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { code: { contains: search, mode: 'insensitive' as const } },
                    { brand: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {}),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                productGroup: { select: { name: true } },
                productStocks: {
                    include: { warehouse: { select: { name: true } } },
                },
                productPrices: {
                    include: { customerGroup: { select: { name: true } } },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.product.count({ where }),
    ]);

    return { products, totalPages: Math.ceil(total / perPage) };
}

export async function createProduct(data: {
    code?: string;
    name: string;
    description?: string;
    unit?: string;
    cost?: number;
    price?: number;
    brand?: string;
    packaging?: string;
    productGroupId?: string;
    pointsPerUnit?: number;
    minStock?: number;
    imageUrl?: string;
    prices?: { customerGroupId: string; price: number }[];
    units?: { unitName: string; conversionRate: number; sellingPrice: number; isBaseUnit: boolean }[];
}) {
    // Auto-generate code: 5-digit running number (00001, 00002, ...)
    let code = data.code?.trim();
    if (!code) {
        // Find max numeric code and increment
        const maxProduct = await prisma.product.findFirst({
            where: { code: { not: { contains: '-' } }, deletedAt: null },
            orderBy: { code: 'desc' },
            select: { code: true },
        });
        const maxNum = maxProduct?.code ? parseInt(maxProduct.code, 10) : 0;
        const nextNum = (isNaN(maxNum) ? await prisma.product.count() : maxNum) + 1;
        code = String(nextNum).padStart(5, '0');
    }

    const product = await prisma.product.create({
        data: {
            code,
            name: data.name,
            description: data.description,
            unit: data.unit || 'bag',
            cost: data.cost || 0,
            price: data.price || 0,
            brand: data.brand || null,
            packaging: data.packaging || null,
            productGroupId: data.productGroupId || null,
            pointsPerUnit: data.pointsPerUnit || 0,
            minStock: data.minStock || 10,
            imageUrl: data.imageUrl || null,
            productPrices: data.prices
                ? {
                    create: data.prices.map((p) => ({
                        customerGroupId: p.customerGroupId,
                        price: p.price,
                    })),
                }
                : undefined,
            productUnits: data.units && data.units.length > 0
                ? {
                    create: data.units.map((u) => ({
                        unitName: u.unitName,
                        conversionRate: u.conversionRate,
                        sellingPrice: u.sellingPrice,
                        isBaseUnit: u.isBaseUnit,
                    })),
                }
                : undefined,
        },
    });
    revalidatePath('/products');
    return product;
}

export async function updateProduct(
    id: string,
    data: {
        name: string;
        description?: string;
        unit?: string;
        cost?: number;
        price?: number;
        brand?: string;
        productGroupId?: string | null;
        pointsPerUnit?: number;
        minStock?: number;
        prices?: { customerGroupId: string; price: number }[];
    }
) {
    await prisma.$transaction(async (tx) => {
        await tx.product.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                unit: data.unit,
                cost: data.cost,
                price: data.price,
                brand: data.brand,
                productGroupId: data.productGroupId,
                pointsPerUnit: data.pointsPerUnit,
                minStock: data.minStock,
            },
        });

        if (data.prices) {
            await tx.productPrice.deleteMany({ where: { productId: id } });
            await tx.productPrice.createMany({
                data: data.prices.map((p) => ({
                    productId: id,
                    customerGroupId: p.customerGroupId,
                    price: p.price,
                })),
            });
        }
    });

    revalidatePath('/products');
}

export async function deleteProduct(id: string) {
    // Check for existing transactions
    const [saleCount, grCount, transferCount, returnCount, factoryReturnCount] = await Promise.all([
        prisma.saleItem.count({ where: { productId: id } }),
        prisma.goodsReceiveItem.count({ where: { productId: id } }),
        prisma.stockTransferItem.count({ where: { productId: id } }),
        prisma.saleReturnItem.count({ where: { productId: id } }),
        prisma.factoryReturnItem.count({ where: { productId: id } }),
    ]);

    const totalTx = saleCount + grCount + transferCount + returnCount + factoryReturnCount;
    if (totalTx > 0) {
        const parts: string[] = [];
        if (saleCount) parts.push(`ขายแล้ว ${saleCount} รายการ`);
        if (grCount) parts.push(`รับเข้า ${grCount} รายการ`);
        if (transferCount) parts.push(`โอนย้าย ${transferCount} รายการ`);
        if (returnCount) parts.push(`คืนสินค้า ${returnCount} รายการ`);
        if (factoryReturnCount) parts.push(`คืนโรงงาน ${factoryReturnCount} รายการ`);
        throw new Error(`ไม่สามารถลบได้ — สินค้านี้มี transaction แล้ว: ${parts.join(', ')}`);
    }

    await prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/products');
}

export async function updateProductCost(
    productId: string,
    costType: 'avg' | 'last' | 'custom',
    customCost?: number
) {
    let newCost: number;
    if (costType === 'avg') {
        // Weighted average cost from ALL GOODS_RECEIVE transactions
        const receives = await prisma.stockTransaction.findMany({
            where: { productId, type: 'GOODS_RECEIVE', quantity: { gt: 0 } },
            select: { quantity: true, unitCost: true },
        });
        if (receives.length > 0) {
            const totalQty = receives.reduce((s, tx) => s + tx.quantity, 0);
            const totalCost = receives.reduce((s, tx) => s + tx.quantity * Number(tx.unitCost), 0);
            newCost = totalQty > 0 ? totalCost / totalQty : 0;
        } else {
            newCost = 0;
        }
    } else if (costType === 'last') {
        // Most recent GOODS_RECEIVE unitCost
        const lastReceive = await prisma.stockTransaction.findFirst({
            where: { productId, type: 'GOODS_RECEIVE', quantity: { gt: 0 } },
            orderBy: { createdAt: 'desc' },
            select: { unitCost: true },
        });
        newCost = lastReceive ? Number(lastReceive.unitCost) : 0;
    } else {
        if (customCost === undefined || customCost < 0) throw new Error('กรุณาระบุต้นทุนที่ถูกต้อง');
        newCost = customCost;
    }

    newCost = Math.round(newCost * 100) / 100;

    await prisma.product.update({
        where: { id: productId },
        data: { cost: newCost },
    });

    revalidatePath('/products');
}
