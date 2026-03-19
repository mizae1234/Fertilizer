'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/generateNumber';

export async function getQuotations(page = 1, search = '', status = '') {
    const perPage = 10;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
        where.OR = [
            { quotationNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }
    if (status) where.status = status;

    const [quotations, total] = await Promise.all([
        prisma.quotation.findMany({
            where,
            include: {
                customer: { select: { name: true, phone: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.quotation.count({ where }),
    ]);

    return { quotations, totalPages: Math.ceil(total / perPage) };
}

export async function getQuotationDetail(id: string) {
    return prisma.quotation.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, phone: true, address: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true } },
                },
            },
        },
    });
}

export async function createQuotation(data: {
    customerId?: string;
    customerName?: string;
    validUntil?: string;
    notes?: string;
    discount?: number;
    userId: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        unitName?: string;
    }[];
}) {
    if (!data.userId) throw new Error('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
    if (!data.items.length) throw new Error('กรุณาเพิ่มรายการสินค้า');

    const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const discount = data.discount || 0;
    const totalAmount = subtotal - discount;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const quotationNumber = await generateNumber('QT');
        try {
            const quotation = await prisma.quotation.create({
                data: {
                    quotationNumber,
                    customerId: data.customerId || null,
                    customerName: data.customerName || null,
                    validUntil: data.validUntil ? new Date(data.validUntil) : null,
                    totalAmount,
                    discount,
                    notes: data.notes || null,
                    status: 'DRAFT',
                    createdById: data.userId,
                    items: {
                        create: data.items.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            totalPrice: i.quantity * i.unitPrice,
                            unitName: i.unitName || null,
                        })),
                    },
                },
            });

            revalidatePath('/quotations');
            return { id: quotation.id, quotationNumber: quotation.quotationNumber };
        } catch (e: any) {
            if (e.message?.includes('Unique constraint') && attempt < 2) {
                lastError = e;
                continue;
            }
            throw e;
        }
    }
    throw lastError || new Error('ไม่สามารถสร้างใบเสนอราคาได้ กรุณาลองใหม่');
}

export async function updateQuotation(id: string, data: {
    customerId?: string | null;
    customerName?: string | null;
    validUntil?: string | null;
    notes?: string | null;
    discount?: number;
    status?: string;
    items?: {
        productId: string;
        quantity: number;
        unitPrice: number;
        unitName?: string;
    }[];
}) {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new Error('ไม่พบใบเสนอราคา');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (data.customerId !== undefined) updateData.customerId = data.customerId || null;
    if (data.customerName !== undefined) updateData.customerName = data.customerName || null;
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;

    if (data.items) {
        const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const discount = data.discount ?? Number(existing.discount);
        updateData.totalAmount = subtotal - discount;
        updateData.discount = discount;

        updateData.items = {
            create: data.items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.quantity * i.unitPrice,
                unitName: i.unitName || null,
            })),
        };
    } else if (data.discount !== undefined) {
        updateData.discount = data.discount;
        updateData.totalAmount = Number(existing.totalAmount) + Number(existing.discount) - data.discount;
    }

    await prisma.$transaction(async (tx) => {
        if (data.items) {
            await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        }
        await tx.quotation.update({ where: { id }, data: updateData });
    });
    revalidatePath('/quotations');
}

export async function deleteQuotation(id: string) {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new Error('ไม่พบใบเสนอราคา');
    if (existing.status !== 'DRAFT') throw new Error('ลบได้เฉพาะใบเสนอราคาสถานะ DRAFT');

    await prisma.quotation.delete({ where: { id } });
    revalidatePath('/quotations');
}
