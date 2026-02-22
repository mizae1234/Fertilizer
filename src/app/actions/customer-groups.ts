'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getCustomerGroups() {
    return prisma.customerGroup.findMany({
        include: { _count: { select: { customers: true, productPrices: true } } },
        orderBy: { name: 'asc' },
    });
}

export async function createCustomerGroup(name: string) {
    if (!name.trim()) throw new Error('กรุณาระบุชื่อกลุ่มลูกค้า');

    const existing = await prisma.customerGroup.findFirst({ where: { name: name.trim() } });
    if (existing) throw new Error('ชื่อกลุ่มลูกค้านี้มีอยู่แล้ว');

    await prisma.customerGroup.create({ data: { name: name.trim() } });
    revalidatePath('/customer-groups');
}

export async function updateCustomerGroup(id: string, name: string) {
    if (!name.trim()) throw new Error('กรุณาระบุชื่อกลุ่มลูกค้า');

    const existing = await prisma.customerGroup.findFirst({
        where: { name: name.trim(), NOT: { id } },
    });
    if (existing) throw new Error('ชื่อกลุ่มลูกค้านี้มีอยู่แล้ว');

    await prisma.customerGroup.update({ where: { id }, data: { name: name.trim() } });
    revalidatePath('/customer-groups');
}

export async function deleteCustomerGroup(id: string) {
    const group = await prisma.customerGroup.findUnique({
        where: { id },
        include: { _count: { select: { customers: true } } },
    });
    if (!group) throw new Error('ไม่พบกลุ่มลูกค้า');
    if (group._count.customers > 0) throw new Error(`ไม่สามารถลบได้ มีลูกค้าในกลุ่มนี้ ${group._count.customers} ราย`);

    // Delete related prices first, then the group
    await prisma.productPrice.deleteMany({ where: { customerGroupId: id } });
    await prisma.customerGroup.delete({ where: { id } });
    revalidatePath('/customer-groups');
}
