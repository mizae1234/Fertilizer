import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoicePrint from './InvoicePrint';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true, id: true } },
                },
            },
        },
    });

    if (!sale) notFound();

    // Find default template (global, not per warehouse)
    let template = await prisma.receiptTemplate.findFirst({
        where: { isDefault: true },
    });
    if (!template) {
        template = await prisma.receiptTemplate.findFirst({
            orderBy: { createdAt: 'asc' },
        });
    }

    // Serialize Decimal and Date fields
    const saleData = JSON.parse(JSON.stringify({
        ...sale,
        totalAmount: Number(sale.totalAmount),
        items: sale.items.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
        })),
    }));

    return <InvoicePrint sale={saleData} template={template} />;
}
