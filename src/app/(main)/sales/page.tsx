import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import SearchBar from '@/components/SearchBar';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';

interface Props { searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string; search?: string }> }

export default async function SalesPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const status = sp.status || '';
    const from = sp.from || '';
    const to = sp.to || '';
    const searchQuery = sp.search || '';
    const perPage = 15;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }
    if (searchQuery) {
        where.OR = [
            { saleNumber: { contains: searchQuery, mode: 'insensitive' as const } },
            { customer: { name: { contains: searchQuery, mode: 'insensitive' as const } } },
        ];
    }

    const [sales, total] = await Promise.all([
        prisma.sale.findMany({
            where,
            select: {
                id: true, saleNumber: true, totalAmount: true, status: true, createdAt: true,
                customer: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
                items: {
                    select: { id: true, quantity: true, unitName: true, product: { select: { name: true, unit: true, productUnits: { select: { unitName: true, conversionRate: true } } } } },
                },
                saleReturns: {
                    select: { items: { select: { saleItemId: true, quantity: true } } },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.sale.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), status, from, to, search: searchQuery, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
        return `/sales?${p.toString()}`;
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="รายการขาย"
                subtitle={`ทั้งหมด ${total} รายการ`}
                actions={
                    <Link href="/pos" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                        🛒 ไปหน้า POS
                    </Link>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Status Filter */}
                    <div className="flex gap-1">
                        {[{ v: '', l: 'ทั้งหมด' }, { v: 'APPROVED', l: 'อนุมัติแล้ว' }, { v: 'CANCELLED', l: 'ยกเลิก' }].map(f => (
                            <Link key={f.v} href={buildUrl({ status: f.v, page: '1' })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${status === f.v || (!status && !f.v) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {f.l}
                            </Link>
                        ))}
                    </div>

                    {/* Date Range */}
                    <Suspense fallback={<div className="ml-auto h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />}>
                        <DateRangeFilter />
                    </Suspense>
                </div>
            </div>
            {/* Search */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <Suspense fallback={<div className="h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                    <SearchBar placeholder="🔍 ค้นหาเลขบิล หรือชื่อลูกค้า..." />
                </Suspense>
            </div>

            {/* Sales Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ลูกค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการสินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sales.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                        ) : (
                            sales.map(sale => (
                                <tr key={sale.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <Link href={`/sales/${sale.id}`} className="text-sm font-medium text-emerald-600 hover:underline">{sale.saleNumber}</Link>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{sale.customer?.name || 'ลูกค้าทั่วไป'}</td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                            {(() => {
                                                // Build returned qty map
                                                const retMap = new Map<string, number>();
                                                for (const sr of sale.saleReturns) {
                                                    for (const ri of sr.items) {
                                                        retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
                                                    }
                                                }
                                                const remaining = sale.items
                                                    .map(item => ({ ...item, qty: item.quantity - (retMap.get(item.id) || 0) }))
                                                    .filter(item => item.qty > 0);
                                                return (<>
                                                    {remaining.slice(0, 3).map((item, i) => (
                                                        <p key={i} className="text-xs text-gray-500">
                                                            {item.product.name} x{item.qty} {item.unitName || item.product.unit}
                                                            {item.unitName && item.unitName !== item.product.unit && (() => {
                                                                const pu = (item.product as any).productUnits?.find((u: any) => u.unitName === item.unitName);
                                                                return pu ? ` (×${Number(pu.conversionRate)})` : '';
                                                            })()}
                                                        </p>
                                                    ))}
                                                    {remaining.length > 3 && (
                                                        <p className="text-xs text-gray-400">+{remaining.length - 3} รายการ</p>
                                                    )}
                                                </>);
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(sale.totalAmount))}</td>
                                    <td className="px-4 py-3"><StatusBadge status={sale.status} /></td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(sale.createdAt)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/sales" params={{ status, from, to, search: searchQuery }} />
                )}
            </div>
        </div>
    );
}
