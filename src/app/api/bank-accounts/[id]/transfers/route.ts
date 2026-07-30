import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        // 1. Fetch approved POS sales
        const sales = await prisma.sale.findMany({
            where: {
                status: 'APPROVED',
                deletedAt: null,
            },
            select: {
                id: true,
                saleNumber: true,
                payments: true,
                createdAt: true,
                customer: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' }
        }) as any[];

        const transferSales = sales.flatMap(sale => {
            const payments = (sale.payments && Array.isArray(sale.payments) ? sale.payments : []) as { method: string; amount: number; bankAccountId?: string }[];
            const matchingPayments = payments.filter(p => p.method === 'TRANSFER' && p.bankAccountId === id);
            if (matchingPayments.length === 0) return [];
            return matchingPayments.map((p, idx) => ({
                id: `${sale.id}-pos-${idx}`,
                date: sale.createdAt,
                reference: sale.saleNumber,
                type: 'POS',
                customerName: sale.customer?.name || 'ลูกค้าทั่วไป',
                amount: Number(p.amount)
            }));
        });

        // 2. Fetch debt payments
        const debtPayments = await prisma.debtPayment.findMany({
            where: {
                bankAccountId: id,
            } as any,
            include: {
                sale: {
                    select: {
                        saleNumber: true,
                        customer: { select: { name: true } }
                    }
                }
            } as any,
            orderBy: { paidAt: 'desc' }
        }) as any[];

        const formattedDebtPayments = debtPayments.map(dp => ({
            id: dp.id,
            date: dp.paidAt,
            reference: dp.sale?.saleNumber || '',
            type: 'PAY_DEBT',
            customerName: dp.sale?.customer?.name || 'ลูกค้าทั่วไป',
            amount: Number(dp.amount)
        }));

        // 3. Merge and sort
        const allTransfers = [...transferSales, ...formattedDebtPayments].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return NextResponse.json(allTransfers);
    } catch (error) {
        console.error('Bank account transfers API error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
