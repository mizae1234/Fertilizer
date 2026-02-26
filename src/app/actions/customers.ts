'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getCustomers(page = 1, search = '') {
    const perPage = 10;
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

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            include: { customerGroup: { select: { name: true } } },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.count({ where }),
    ]);

    return { customers, totalPages: Math.ceil(total / perPage) };
}

export async function createCustomer(data: {
    name: string;
    phone: string;
    customerGroupId: string;
    address?: string;
    taxId?: string;
}) {
    const customer = await prisma.customer.create({
        data: {
            name: data.name,
            phone: data.phone,
            customerGroupId: data.customerGroupId,
            address: data.address || null,
            taxId: data.taxId || null,
        },
    });
    revalidatePath('/customers');
    return customer;
}

export async function updateCustomer(
    id: string,
    data: { name: string; phone: string; customerGroupId: string; address?: string; taxId?: string }
) {
    await prisma.customer.update({
        where: { id },
        data: {
            name: data.name,
            phone: data.phone,
            customerGroupId: data.customerGroupId,
            address: data.address || null,
            taxId: data.taxId || null,
        },
    });
    revalidatePath('/customers');
}

export async function deleteCustomer(id: string) {
    await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/customers');
}

export async function redeemPoints(customerId: string, points: number, description: string) {
    if (points <= 0) throw new Error('จำนวนแต้มต้องมากกว่า 0');
    if (!description.trim()) throw new Error('กรุณาระบุหมายเหตุ');

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('ไม่พบลูกค้า');
    if (customer.totalPoints < points) throw new Error(`แต้มไม่พอ (มี ${customer.totalPoints} แต้ม)`);

    await prisma.$transaction(async (tx) => {
        await tx.pointTransaction.create({
            data: {
                customerId,
                points,
                type: 'REDEEM',
                description: description.trim(),
            },
        });
        await tx.customer.update({
            where: { id: customerId },
            data: { totalPoints: { decrement: points } },
        });
    });

    revalidatePath(`/customers/${customerId}`);
}

export async function getCustomerDetail(id: string) {
    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            customerGroup: true,
            pointTransactions: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
            sales: {
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    items: {
                        include: { product: { select: { name: true } } },
                    },
                },
            },
        },
    });
    return customer;
}
