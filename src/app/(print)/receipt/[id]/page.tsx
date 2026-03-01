import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReceiptPrint from './ReceiptPrint';

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cashReceived?: string }> }) {
    const { id } = await params;
    const { cashReceived: cashReceivedStr } = await searchParams;
    const cashReceived = cashReceivedStr ? parseFloat(cashReceivedStr) : undefined;

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
        discount: Number(sale.discount || 0),
        items: adjustedItems.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
        })),
    }));

    const templateData = template ? {
        shopName: template.name || 'Fertilizer POS',
        headerText: template.headerText || null,
        footer: template.footerText || null,
        showLogo: template.showLogo ?? false,
        logoUrl: template.logoUrl || null,
        showQr: template.showQr ?? false,
        qrCodeUrl: template.qrCodeUrl || null,
        showBillNo: template.showBillNo ?? true,
        showStaff: template.showStaff ?? true,
        showCustomer: template.showCustomer ?? true,
    } : null;

    return <ReceiptPrint sale={saleData} template={templateData} cashReceived={cashReceived} />;
}
