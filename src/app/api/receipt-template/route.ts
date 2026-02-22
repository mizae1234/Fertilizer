import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — list all templates (global, not per warehouse)
export async function GET() {
    const templates = await prisma.receiptTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(templates);
}

// POST — create or update a template
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            id,
            name,
            isDefault,
            showLogo,
            logoUrl,
            headerText,
            footerText,
            showBillNo,
            showVat,
            showQr,
            showStaff,
            showCustomer,
            paperSize,
        } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const data = {
            name: name.trim(),
            isDefault: isDefault ?? false,
            showLogo: showLogo ?? false,
            logoUrl: logoUrl || null,
            headerText: headerText || '',
            footerText: footerText || '',
            showBillNo: showBillNo ?? true,
            showVat: showVat ?? false,
            showQr: showQr ?? false,
            showStaff: showStaff ?? true,
            showCustomer: showCustomer ?? true,
            paperSize: paperSize || '58mm',
        };

        // If setting as default, unset other defaults
        if (data.isDefault) {
            await prisma.receiptTemplate.updateMany({
                where: { isDefault: true, ...(id ? { NOT: { id } } : {}) },
                data: { isDefault: false },
            });
        }

        let template;
        if (id) {
            template = await prisma.receiptTemplate.update({
                where: { id },
                data,
            });
        } else {
            template = await prisma.receiptTemplate.create({ data });
        }

        return NextResponse.json(template);
    } catch (error) {
        console.error('Receipt template save error:', error);
        return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }
}

// DELETE — delete a template
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        await prisma.receiptTemplate.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Receipt template delete error:', error);
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }
}
