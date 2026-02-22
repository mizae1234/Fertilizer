import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — list all product groups
export async function GET() {
    const groups = await prisma.productGroup.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(groups);
}

// POST — create a product group
export async function POST(req: NextRequest) {
    try {
        const { name } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'ชื่อหมวดหมู่จำเป็น' }, { status: 400 });
        }
        const group = await prisma.productGroup.create({ data: { name: name.trim() } });
        return NextResponse.json(group);
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            return NextResponse.json({ error: 'ชื่อหมวดหมู่ซ้ำ' }, { status: 409 });
        }
        return NextResponse.json({ error: 'ไม่สามารถสร้างได้' }, { status: 500 });
    }
}

// DELETE — delete a product group
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        // Unlink products first
        await prisma.product.updateMany({
            where: { productGroupId: id },
            data: { productGroupId: null },
        });
        await prisma.productGroup.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'ไม่สามารถลบได้' }, { status: 500 });
    }
}
