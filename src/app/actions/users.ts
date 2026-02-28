'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { hashPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
    return prisma.user.findMany({
        where: { deletedAt: null },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            allowedMenus: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            allowedMenus: true,
        },
    });
}

export async function createUser(data: {
    username: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'STAFF';
    allowedMenus: string[] | null;
}) {
    // Check if username already exists
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
        throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
    }

    const hashedPwd = await hashPassword(data.password);

    const user = await prisma.user.create({
        data: {
            username: data.username,
            password: hashedPwd,
            name: data.name,
            role: data.role,
            allowedMenus: data.allowedMenus === null ? Prisma.JsonNull : data.allowedMenus,
        },
    });

    revalidatePath('/users');
    return user;
}

export async function updateUser(
    id: string,
    data: {
        username?: string;
        password?: string;
        name?: string;
        role?: 'ADMIN' | 'STAFF';
        allowedMenus?: string[] | null;
    }
) {
    // If username is changing, check uniqueness
    if (data.username) {
        const existing = await prisma.user.findUnique({ where: { username: data.username } });
        if (existing && existing.id !== id) {
            throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
        }
    }

    const updateData: Record<string, unknown> = {};
    if (data.username) updateData.username = data.username;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password = await hashPassword(data.password);
    if ('allowedMenus' in data) updateData.allowedMenus = data.allowedMenus === null ? Prisma.JsonNull : data.allowedMenus;

    const user = await prisma.user.update({
        where: { id },
        data: updateData,
    });

    revalidatePath('/users');
    return user;
}

export async function deleteUser(id: string) {
    // ป้องกันลบ user admin
    const user = await prisma.user.findUnique({ where: { id }, select: { username: true } });
    if (user?.username === 'admin') {
        throw new Error('ไม่สามารถลบผู้ใช้ admin ได้');
    }
    await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
    revalidatePath('/users');
}
