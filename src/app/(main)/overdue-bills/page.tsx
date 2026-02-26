import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Suspense } from 'react';
import OverdueDateFilter from './OverdueDateFilter';

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string; q?: string }> }

export default async function OverdueBillsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const from = sp.from || '';
    const to = sp.to || '';
    const q = sp.q || '';
    const perPage = 15;

    const where: Record<string, unknown> = {
        deletedAt: null,
        status: 'APPROVED',
        paymentMethod: 'CREDIT',
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
        ];
    }

    const [sales, total, totalAmount] = await Promise.all([
        prisma.sale.findMany({
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
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { creditDueDate: 'asc' },
        }),
        prisma.sale.count({ where }),
        prisma.sale.aggregate({ where, _sum: { totalAmount: true } }),
    ]);

    const totalPages = Math.ceil(total / perPage);

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

    // Calculate total remaining across all filtered bills
    const totalRemaining = sales.reduce((sum, sale) => sum + getPaymentSplit(sale).remaining, 0);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), from, to, q, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">📋 บิลค้างจ่าย</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        ทั้งหมด {total} รายการ · มูลค่ารวม {formatCurrency(Number(totalAmount._sum.totalAmount || 0))}
                        {' · '}<span className="text-red-600 font-semibold">ยอดค้างรวม {formatCurrency(totalRemaining)}</span>
                    </p>
                </div>
            </div>

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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่บิล</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ลูกค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการสินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่าบิล</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จ่ายแล้ว</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ค้างจ่าย</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">กำหนดชำระ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่ขาย</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sales.length === 0 ? (
                            <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
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
                                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(sale.createdAt)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">หน้า {page} จาก {totalPages}</p>
                        <div className="flex gap-1">
                            {page > 1 && <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ก่อนหน้า</Link>}
                            {page < totalPages && <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ถัดไป</Link>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
