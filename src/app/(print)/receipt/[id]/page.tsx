import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReceiptPrint from './ReceiptPrint';
import { roundQty } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cashReceived?: string }> }) {
    const { id } = await params;
    const { cashReceived: cashReceivedStr } = await searchParams;
    const cashReceivedParam = cashReceivedStr ? parseFloat(cashReceivedStr) : undefined;

    const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true, address: true, taxId: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                },
            },
            saleReturns: {
                include: { items: true },
            },
            debtPayments: {
                select: { amount: true },
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
            const remaining = roundQty(item.quantity - returned);
            return { ...item, quantity: remaining, totalPrice: Math.round(remaining * Number(item.unitPrice) * 100) / 100 };
        })
        .filter(item => item.quantity > 0);

    // Find default receipt template & shop info
    const [defaultTemplate, shopInfo] = await Promise.all([
        prisma.receiptTemplate.findFirst({ where: { isDefault: true } }),
        prisma.shopInfo.findUnique({ where: { id: 'shop-info' } }),
    ]);
    let template = defaultTemplate;
    if (!template) {
        template = await prisma.receiptTemplate.findFirst({
            orderBy: { createdAt: 'asc' },
        });
    }

    const saleData = JSON.parse(JSON.stringify({
        ...sale,
        totalAmount: Number(sale.totalAmount),
        discount: Number(sale.discount || 0),
        debtPaid: sale.debtPayments.reduce((s, p) => s + Number(p.amount), 0),
        items: adjustedItems.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Math.round(Number(item.totalPrice) * 100) / 100,
            discount: Number(item.discount || 0),
        })),
    }));

    const resolvedShopName =
        shopInfo?.name?.trim() ||
        template?.headerText?.split('\n').map(l => l.trim()).find(Boolean) ||
        (template?.name && template.name !== 'Default' ? template.name : '') ||
        'ร้านค้า';

    const templateData = template ? {
        shopName: resolvedShopName,
        headerText: template.headerText || null,
        footer: template.footerText || null,
        showLogo: template.showLogo ?? false,
        logoUrl: template.logoUrl || null,
        showQr: template.showQr ?? false,
        qrCodeUrl: template.qrCodeUrl || null,
        showBillNo: template.showBillNo ?? true,
        showStaff: template.showStaff ?? true,
        showCustomer: template.showCustomer ?? true,
        paperSize: template.paperSize || '80mm',
    } : {
        shopName: resolvedShopName,
        headerText: null,
        footer: null,
        showLogo: false,
        logoUrl: null,
        showQr: false,
        qrCodeUrl: null,
        showBillNo: true,
        showStaff: true,
        showCustomer: true,
        paperSize: '80mm',
    };

    const cashReceived = sale.cashReceived ? Number(sale.cashReceived) : cashReceivedParam;

    return <ReceiptPrint sale={saleData} template={templateData} cashReceived={cashReceived} />;
}
