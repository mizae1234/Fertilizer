import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Suspense } from 'react';
import OverdueDateFilter from './OverdueDateFilter';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import SortableHeader from '@/components/SortableHeader';

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string; q?: string; sort?: string; order?: string }> }

export default async function OverdueBillsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const from = sp.from || '';
    const to = sp.to || '';
    const q = sp.q || '';
    const sort = sp.sort || 'creditDueDate';
    const order = sp.order || 'asc';
    const perPage = 15;

    const where: Record<string, unknown> = {
        deletedAt: null,
        status: 'APPROVED',
        paymentMethod: { in: ['CREDIT', 'SPLIT'] },  // Excludes 'PAID' bills at DB level
    };

    // Filter by due date range
    if (from || to) {
        where.creditDueDate = {};
        if (from) (where.creditDueDate as Record<string, unknown>).gte = new Date(from);
        if (to) (where.creditDueDate as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    // Search by saleNumber or customer name
    if (q) {
        where.OR = [
            { saleNumber: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { createdBy: { name: { contains: q, mode: 'insensitive' } } },
        ];
    }

    // Build orderBy from sort param
    const allowedSorts: Record<string, any> = {
        saleNumber: { saleNumber: order === 'asc' ? 'asc' : 'desc' },
        customer: { customer: { name: order === 'asc' ? 'asc' : 'desc' } },
        totalAmount: { totalAmount: order === 'asc' ? 'asc' : 'desc' },
        creditDueDate: { creditDueDate: order === 'asc' ? 'asc' : 'desc' },
        createdAt: { createdAt: order === 'asc' ? 'asc' : 'desc' },
    };
    const orderBy = allowedSorts[sort] || { creditDueDate: 'asc' };

    // Fetch ALL matching bills first (without pagination), then filter by remaining > 0
    // This is needed because the outstanding balance calculation involves JSON payments + debtPayments
    // which can't be expressed in a Prisma WHERE clause
    const allSales = await prisma.sale.findMany({
        where,
        select: {
            id: true, saleNumber: true, totalAmount: true, status: true,
            paymentMethod: true, creditDueDate: true, payments: true, createdAt: true,
            customer: { select: { name: true } },
            createdBy: { select: { name: true } },
            _count: { select: { items: true } },
            debtPayments: { select: { amount: true, method: true } },
            debtInterests: { select: { amount: true } },
        },
        orderBy,
    });

    const now = new Date();

    // Calculate paid vs remaining including debt payments and interest
    const getPaymentSplit = (sale: {
        totalAmount: unknown; payments: unknown;
        debtPayments: { amount: unknown; method: string }[];
        debtInterests: { amount: unknown }[];
    }) => {
        const total = Number(sale.totalAmount);
        const totalInterest = sale.debtInterests.reduce((s, di) => s + Number(di.amount), 0);
        const grandTotal = total + totalInterest;

        // Initial paid from POS (non-credit)
        let initialPaid = 0;
        if (sale.payments && typeof sale.payments === 'object' && Array.isArray(sale.payments)) {
            for (const p of sale.payments as { method: string; amount: number }[]) {
                if (p.method !== 'CREDIT') {
                    initialPaid += Number(p.amount);
                }
            }
        }

        // Subsequent debt payments (non-credit)
        const debtPaid = sale.debtPayments
            .filter(dp => dp.method !== 'CREDIT')
            .reduce((s, dp) => s + Number(dp.amount), 0);

        const paidAmount = initialPaid + debtPaid;
        const remaining = grandTotal - paidAmount;
        return { paidAmount, remaining: remaining > 0 ? remaining : 0 };
    };

    // Filter out fully-paid bills (use same tolerance as debt.ts isPaidOff: <= 0.01)
    const unpaidSales = allSales.filter(sale => getPaymentSplit(sale).remaining > 0.01);

    // Auto-fix: mark any fully-paid bills as 'PAID' if they were missed
    const paidButNotMarked = allSales.filter(sale =>
        getPaymentSplit(sale).remaining <= 0.01 && sale.paymentMethod !== 'PAID'
    );
    if (paidButNotMarked.length > 0) {
        await Promise.all(paidButNotMarked.map(sale =>
            prisma.sale.update({ where: { id: sale.id }, data: { paymentMethod: 'PAID' } })
        ));
    }

    const total = unpaidSales.length;
    const totalPages = Math.ceil(total / perPage);
    const sales = unpaidSales.slice((page - 1) * perPage, page * perPage);

    // Calculate total remaining across all filtered bills
    const totalRemaining = unpaidSales.reduce((sum, sale) => sum + getPaymentSplit(sale).remaining, 0);
    const totalBillAmount = unpaidSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), from, to, q, sort, order, ...params };
        Object.entries(vals).forEach(([k, v]) => {
            if (v && !(k === 'sort' && v === 'creditDueDate') && !(k === 'order' && v === 'asc')) p.set(k, v);
        });
        return `/overdue-bills?${p.toString()}`;
    };

    const getDaysOverdue = (dueDate: Date | null): number => {
        if (!dueDate) return 0;
        const diff = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000);
        return diff;
    };

    const getOverdueColor = (days: number): string => {
        if (days <= 0) return 'text-emerald-600';
        if (days <= 30) return 'text-orange-500';
        if (days <= 60) return 'text-red-500';
        return 'text-red-700';
    };

    const getOverdueLabel = (days: number): string => {
        if (days <= 0) return 'ยังไม่ถึงกำหนด';
        if (days === 1) return 'เกิน 1 วัน';
        return `เกิน ${days} วัน`;
    };

    const overdueCount = sales.filter(s => getDaysOverdue(s.creditDueDate) > 0).length;

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="📋 บิลค้างจ่าย"
                subtitle={`ทั้งหมด ${total} รายการ · มูลค่ารวม ${formatCurrency(totalBillAmount)} · ยอดค้างรวม ${formatCurrency(totalRemaining)}`}
            />

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Quick stats */}
                    <div className="flex gap-2 mr-auto">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                            ⚠️ เกินกำหนด {overdueCount} บิล
                        </span>
                        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                            ทั้งหมด {total} บิล
                        </span>
                    </div>

                    {/* Date & Search Filter */}
                    <Suspense fallback={<div className="ml-auto h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />}>
                        <OverdueDateFilter />
                    </Suspense>
                </div>
            </div>

            {/* Bills Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <SortableHeader label="เลขที่บิล" field="saleNumber" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <SortableHeader label="ลูกค้า" field="customer" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการสินค้า</th>
                            <SortableHeader label="มูลค่าบิล" field="totalAmount" currentSort={sort} currentOrder={order} buildUrl={buildUrl} align="right" />
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จ่ายแล้ว</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ค้างจ่าย</th>
                            <SortableHeader label="กำหนดชำระ" field="creditDueDate" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้ทำรายการ</th>
                            <SortableHeader label="วันที่ขาย" field="createdAt" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sales.length === 0 ? (
                            <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                        ) : (
                            sales.map(sale => {
                                const daysOverdue = getDaysOverdue(sale.creditDueDate);
                                const isOverdue = daysOverdue > 0;
                                const { paidAmount, remaining } = getPaymentSplit(sale);
                                return (
                                    <tr key={sale.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <Link href={`/overdue-bills/${sale.id}`} className="text-sm font-medium text-emerald-600 hover:underline">{sale.saleNumber}</Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{sale.customer?.name || 'ลูกค้าทั่วไป'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {sale._count.items} รายการ
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(sale.totalAmount))}</td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            <span className={paidAmount > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{formatCurrency(paidAmount)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            <span className="text-red-600 font-semibold">{formatCurrency(remaining)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-600">{sale.creditDueDate ? formatDate(sale.creditDueDate) : '-'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold ${getOverdueColor(daysOverdue)}`}>
                                                {isOverdue ? '🔴' : '🟢'} {getOverdueLabel(daysOverdue)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{sale.createdBy?.name || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(sale.createdAt)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/overdue-bills" params={{ from, to, q, sort, order }} />
                )}
            </div>
        </div>
    );
}
