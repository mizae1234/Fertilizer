import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const accounts = await prisma.bankAccount.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { accountName, accountNumber, bankName, qrCodeUrl, isDefault } = body;

    if (!accountName || !accountNumber || !bankName) {
        return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    // If setting as default, unset all others
    if (isDefault) {
        await prisma.bankAccount.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
        });
    }

    const account = await prisma.bankAccount.create({
        data: { accountName, accountNumber, bankName, qrCodeUrl: qrCodeUrl || null, isDefault: isDefault || false },
    });

    return NextResponse.json(account, { status: 201 });
}
