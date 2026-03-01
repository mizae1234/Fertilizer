import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import QuotationPrint from './QuotationPrint';

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, phone: true, address: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                },
            },
        },
    });

    if (!quotation) notFound();

    // Fetch shop info
    const shopInfo = await prisma.shopInfo.findFirst();

    // Find default template for header/logo
    let template = await prisma.receiptTemplate.findFirst({
        where: { isDefault: true },
    });
    if (!template) {
        template = await prisma.receiptTemplate.findFirst({
            orderBy: { createdAt: 'asc' },
        });
    }

    const data = JSON.parse(JSON.stringify({
        ...quotation,
        totalAmount: Number(quotation.totalAmount),
        discount: Number(quotation.discount || 0),
        items: quotation.items.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
        })),
    }));

    return <QuotationPrint quotation={data} template={template} shopInfo={shopInfo} />;
}
