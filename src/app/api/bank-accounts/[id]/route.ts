import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json();
    const { accountName, accountNumber, bankName, qrCodeUrl, isDefault, isActive } = body;

    // If setting as default, unset all others
    if (isDefault) {
        await prisma.bankAccount.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
        });
    }

    const account = await prisma.bankAccount.update({
        where: { id },
        data: {
            ...(accountName !== undefined && { accountName }),
            ...(accountNumber !== undefined && { accountNumber }),
            ...(bankName !== undefined && { bankName }),
            ...(qrCodeUrl !== undefined && { qrCodeUrl }),
            ...(isDefault !== undefined && { isDefault }),
            ...(isActive !== undefined && { isActive }),
        },
    });

    return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await prisma.bankAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
