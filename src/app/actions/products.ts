'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerUser } from '@/lib/server-auth';

export async function getProducts(page = 1, search = '') {
    const perPage = 10;
    const searchTokens = search.trim().split(/\s+/).filter(Boolean);
    const where = {
        deletedAt: null,
        ...(searchTokens.length > 0
            ? {
                AND: searchTokens.map(token => {
                    const paddedToken = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
                    return {
                        OR: [
                            { name: { contains: token, mode: 'insensitive' as const } },
                            { code: { contains: token, mode: 'insensitive' as const } },
                            ...(paddedToken !== token ? [{ code: { contains: paddedToken, mode: 'insensitive' as const } }] : []),
                            { barcode: { contains: token, mode: 'insensitive' as const } },
                            { brand: { contains: token, mode: 'insensitive' as const } },
                            { packaging: { contains: token, mode: 'insensitive' as const } },
                            { description: { contains: token, mode: 'insensitive' as const } },
                            { productGroup: { name: { contains: token, mode: 'insensitive' as const } } },
                        ],
                    };
                }),
            }
            : {}),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                productGroup: { select: { name: true } },
                productStocks: {
                    where: { warehouse: { deletedAt: null, isActive: true } },
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
    barcode?: string | null;
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
    mfgDate?: string | Date | null;
    expDate?: string | Date | null;
    prices?: { customerGroupId: string; price: number }[];
    units?: { unitName: string; conversionRate: number; sellingPrice: number; isBaseUnit: boolean }[];
}) {
    // Auto-generate code: 5-digit running number (00001, 00002, ...)
    let code = data.code?.trim();
    if (!code) {
        // Find max numeric code from ALL products (including soft-deleted) to avoid unique constraint violation
        const allNumericProducts = await prisma.product.findMany({
            where: { code: { not: { contains: '-' } } },
            select: { code: true },
            orderBy: { code: 'desc' },
            take: 1,
        });
        const maxNum = allNumericProducts.length > 0 ? parseInt(allNumericProducts[0].code, 10) : 0;
        let nextNum = (isNaN(maxNum) ? await prisma.product.count() : maxNum) + 1;
        code = String(nextNum).padStart(5, '0');

        // Safety: ensure code doesn't already exist (retry up to 10 times)
        for (let i = 0; i < 10; i++) {
            const exists = await prisma.product.findUnique({ where: { code } });
            if (!exists) break;
            nextNum++;
            code = String(nextNum).padStart(5, '0');
        }
    }

    const barcode = data.barcode?.trim() || null;
    if (barcode) {
        const existingBarcode = await prisma.product.findFirst({
            where: { barcode, deletedAt: null },
            select: { id: true, name: true, code: true },
        });
        if (existingBarcode) {
            throw new Error(`บาร์โค้ด "${barcode}" ถูกใช้แล้วโดยสินค้า "${existingBarcode.name}" (${existingBarcode.code})`);
        }
    }

    const product = await prisma.product.create({
        data: {
            code,
            barcode,
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
            mfgDate: data.mfgDate ? new Date(data.mfgDate) : null,
            expDate: data.expDate ? new Date(data.expDate) : null,
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
        code?: string;
        barcode?: string | null;
        name: string;
        description?: string;
        unit?: string;
        cost?: number;
        price?: number;
        brand?: string;
        packaging?: string;
        productGroupId?: string | null;
        pointsPerUnit?: number;
        minStock?: number;
        mfgDate?: string | Date | null;
        expDate?: string | Date | null;
        prices?: { customerGroupId: string; price: number }[];
    }
) {
    if (data.barcode !== undefined) {
        const barcode = data.barcode?.trim() || null;
        if (barcode) {
            const existingBarcode = await prisma.product.findFirst({
                where: { barcode, id: { not: id }, deletedAt: null },
                select: { id: true, name: true, code: true },
            });
            if (existingBarcode) {
                throw new Error(`บาร์โค้ด "${barcode}" ถูกใช้แล้วโดยสินค้า "${existingBarcode.name}" (${existingBarcode.code})`);
            }
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.product.update({
            where: { id },
            data: {
                ...(data.code ? { code: data.code.trim() } : {}),
                ...(data.barcode !== undefined ? { barcode: data.barcode?.trim() || null } : {}),
                name: data.name,
                description: data.description,
                unit: data.unit,
                cost: data.cost,
                price: data.price,
                brand: data.brand,
                packaging: data.packaging,
                productGroupId: data.productGroupId,
                pointsPerUnit: data.pointsPerUnit,
                minStock: data.minStock,
                ...(data.mfgDate !== undefined ? { mfgDate: data.mfgDate ? new Date(data.mfgDate) : null } : {}),
                ...(data.expDate !== undefined ? { expDate: data.expDate ? new Date(data.expDate) : null } : {}),
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
        // Weighted average from ALL GOODS_RECEIVE StockTransactions
        const receives = await prisma.stockTransaction.findMany({
            where: { productId, type: 'GOODS_RECEIVE', quantity: { gt: 0 } },
            select: { quantity: true, unitCost: true },
        });
        if (receives.length > 0) {
            const totalQty = receives.reduce((s, r) => s + r.quantity, 0);
            const totalCost = receives.reduce((s, r) => s + r.quantity * Number(r.unitCost), 0);
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

export async function updateProductCategory(productId: string, productGroupId: string | null) {
    const serverUser = await getServerUser();
    const oldProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { productGroupId: true, productGroup: { select: { name: true } } },
    });

    const newGroup = productGroupId ? await prisma.productGroup.findUnique({
        where: { id: productGroupId },
        select: { name: true },
    }) : null;

    const oldName = oldProduct?.productGroup?.name || 'ไม่ระบุ';
    const newName = newGroup?.name || 'ไม่ระบุ';

    const updated = await prisma.product.update({
        where: { id: productId },
        data: {
            productGroupId: productGroupId || null,
        },
        select: {
            id: true,
            productGroupId: true,
            productGroup: { select: { id: true, name: true } },
        },
    });

    if (oldProduct?.productGroupId !== productGroupId) {
        await prisma.productLog.create({
            data: {
                productId,
                userId: serverUser?.userId || null,
                action: 'UPDATE',
                field: 'productGroupId',
                oldValue: oldName,
                newValue: newName,
                details: `แก้ไขหมวดหมู่สินค้า: "${oldName}" → "${newName}"`,
            },
        });
    }

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    return updated;
}

export async function updateProductBrand(productId: string, brand: string | null) {
    const serverUser = await getServerUser();
    const trimmed = brand?.trim() || null;
    const oldProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { brand: true },
    });

    const oldBrand = oldProduct?.brand || 'ไม่ระบุ';
    const newBrand = trimmed || 'ไม่ระบุ';

    const updated = await prisma.product.update({
        where: { id: productId },
        data: {
            brand: trimmed,
        },
        select: {
            id: true,
            brand: true,
        },
    });

    if (oldProduct?.brand !== trimmed) {
        await prisma.productLog.create({
            data: {
                productId,
                userId: serverUser?.userId || null,
                action: 'UPDATE',
                field: 'brand',
                oldValue: oldBrand,
                newValue: newBrand,
                details: `แก้ไขยี่ห้อ (Brand): "${oldBrand}" → "${newBrand}"`,
            },
        });
    }

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    return updated;
}

export async function bulkUpdateProducts(
    productIds: string[],
    updates: { productGroupId?: string | null; brand?: string | null }
) {
    if (!productIds || productIds.length === 0) return { count: 0 };
    const serverUser = await getServerUser();
    const data: Record<string, unknown> = {};
    if (updates.productGroupId !== undefined) {
        data.productGroupId = updates.productGroupId || null;
    }
    if (updates.brand !== undefined) {
        data.brand = updates.brand ? updates.brand.trim() || null : null;
    }

    // Fetch old products for audit logging
    const oldProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, brand: true, productGroupId: true, productGroup: { select: { name: true } } },
    });

    const targetGroup = updates.productGroupId ? await prisma.productGroup.findUnique({
        where: { id: updates.productGroupId },
        select: { name: true },
    }) : null;
    const newGroupName = updates.productGroupId ? (targetGroup?.name || 'ไม่ระบุ') : 'ไม่ระบุ';
    const newBrandName = updates.brand ? updates.brand.trim() : 'ไม่ระบุ';

    const result = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data,
    });

    // Create logs for each product
    const logs: { productId: string; userId: string | null; action: string; field: string; oldValue: string; newValue: string; details: string }[] = [];
    for (const op of oldProducts) {
        if (updates.productGroupId !== undefined && op.productGroupId !== updates.productGroupId) {
            const oldGName = op.productGroup?.name || 'ไม่ระบุ';
            logs.push({
                productId: op.id,
                userId: serverUser?.userId || null,
                action: 'UPDATE',
                field: 'productGroupId',
                oldValue: oldGName,
                newValue: newGroupName,
                details: `แก้ไขหมวดหมู่สินค้า (แก้ไขแบบกลุ่ม): "${oldGName}" → "${newGroupName}"`,
            });
        }
        if (updates.brand !== undefined && op.brand !== (updates.brand ? updates.brand.trim() || null : null)) {
            const oldBName = op.brand || 'ไม่ระบุ';
            logs.push({
                productId: op.id,
                userId: serverUser?.userId || null,
                action: 'UPDATE',
                field: 'brand',
                oldValue: oldBName,
                newValue: newBrandName,
                details: `แก้ไขยี่ห้อ (แก้ไขแบบกลุ่ม): "${oldBName}" → "${newBrandName}"`,
            });
        }
    }

    if (logs.length > 0) {
        await prisma.productLog.createMany({ data: logs });
    }

    revalidatePath('/products');
    return result;
}

