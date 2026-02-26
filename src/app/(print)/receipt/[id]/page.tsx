import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReceiptPrint from './ReceiptPrint';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                },
            },
        },
    });

    if (!sale) notFound();

    // Find default receipt template
    let template = await prisma.receiptTemplate.findFirst({
        where: { isDefault: true },
    });
    if (!template) {
        template = await prisma.receiptTemplate.findFirst({
            orderBy: { createdAt: 'asc' },
        });
    }

    const saleData = JSON.parse(JSON.stringify({
        ...sale,
        totalAmount: Number(sale.totalAmount),
        items: sale.items.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
        })),
    }));

    return <ReceiptPrint sale={saleData} template={template} />;
}
