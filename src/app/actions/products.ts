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
        const count = await prisma.product.count();
        code = String(count + 1).padStart(5, '0');
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
    const stocks = await prisma.productStock.findMany({ where: { productId } });

    let newCost: number;
    if (costType === 'avg') {
        // Weighted average cost across all warehouses
        const totalQty = stocks.reduce((s, st) => s + st.quantity, 0);
        newCost = totalQty > 0
            ? stocks.reduce((s, st) => s + Number(st.avgCost) * st.quantity, 0) / totalQty
            : stocks.length > 0 ? Number(stocks[0].avgCost) : 0;
    } else if (costType === 'last') {
        // Max last cost across warehouses (most recent receive cost)
        newCost = stocks.length > 0
            ? Math.max(...stocks.map(st => Number(st.lastCost)))
            : 0;
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
