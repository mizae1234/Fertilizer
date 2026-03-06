import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoicePrint from './InvoicePrint';

export const dynamic = 'force-dynamic';

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
            saleReturns: {
                include: { items: true },
            },
        },
    });

    if (!sale) notFound();

    // Build returned quantity map per saleItemId
    const returnedMap = new Map<string, number>();
    for (const sr of sale.saleReturns) {
        for (const ri of sr.items) {
            returnedMap.set(ri.saleItemId, (returnedMap.get(ri.saleItemId) || 0) + ri.quantity);
        }
    }

    // Adjust items: reduce quantities, filter out fully returned
    const adjustedItems = sale.items
        .map(item => {
            const returned = returnedMap.get(item.id) || 0;
            const remaining = item.quantity - returned;
            return { ...item, quantity: remaining, totalPrice: remaining * Number(item.unitPrice) };
        })
        .filter(item => item.quantity > 0);

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
        discount: Number(sale.discount || 0),
        items: adjustedItems.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
        })),
    }));

    return <InvoicePrint sale={saleData} template={template} />;
}
