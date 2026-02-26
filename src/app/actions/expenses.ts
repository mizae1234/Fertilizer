'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateNumber } from '@/lib/utils';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function getExpenses(page = 1, search = '', category = '', dateFrom = '', dateTo = '') {
    const perPage = 10;

    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const where = {
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(hasDateFilter ? { expenseDate: dateFilter } : {}),
        ...(search
            ? {
                OR: [
                    { description: { contains: search, mode: 'insensitive' as const } },
                    { expenseNumber: { contains: search, mode: 'insensitive' as const } },
                    { reference: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {}),
    };

    const [expenses, total, sumResult] = await Promise.all([
        prisma.expense.findMany({
            where,
            include: {
                createdBy: { select: { name: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { expenseDate: 'desc' },
        }),
        prisma.expense.count({ where }),
        prisma.expense.aggregate({
            where,
            _sum: { amount: true },
        }),
    ]);

    return {
        expenses,
        totalPages: Math.ceil(total / perPage),
        totalAmount: sumResult._sum.amount || 0,
        totalCount: total,
    };
}

export async function createExpense(data: {
    category: string;
    amount: number;
    description?: string;
    reference?: string;
    expenseDate?: string;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
    const payload = verifyToken(token);
    if (!payload) throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');

    if (!data.category?.trim()) throw new Error('กรุณาเลือกหมวดหมู่');
    if (!data.amount || data.amount <= 0) throw new Error('กรุณาระบุจำนวนเงิน');

    const expense = await prisma.expense.create({
        data: {
            expenseNumber: generateNumber('EXP'),
            category: data.category.trim(),
            amount: data.amount,
            description: data.description?.trim() || null,
            reference: data.reference?.trim() || null,
            expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
            createdById: payload.userId,
        },
    });

    revalidatePath('/expenses');
    return expense;
}

export async function updateExpense(id: string, data: {
    category: string;
    amount: number;
    description?: string;
    reference?: string;
    expenseDate?: string;
}) {
    if (!data.category?.trim()) throw new Error('กรุณาเลือกหมวดหมู่');
    if (!data.amount || data.amount <= 0) throw new Error('กรุณาระบุจำนวนเงิน');

    const expense = await prisma.expense.update({
        where: { id },
        data: {
            category: data.category.trim(),
            amount: data.amount,
            description: data.description?.trim() || null,
            reference: data.reference?.trim() || null,
            expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
        },
    });

    revalidatePath('/expenses');
    return expense;
}

export async function deleteExpense(id: string) {
    await prisma.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/expenses');
}
