import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';

interface Props { searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string; search?: string }> }

export default async function SalesPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const status = sp.status || '';
    const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
    const from = sp.from || defaultFrom();
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
            { saleNumber: { contains: searchQuery } },
            { customer: { name: { contains: searchQuery } } },
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
                    take: 3,
                    select: { quantity: true, unitName: true, product: { select: { name: true, unit: true, productUnits: { select: { unitName: true, conversionRate: true } } } } },
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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">รายการขาย</h1>
                    <p className="text-sm text-gray-500 mt-1">ทั้งหมด {total} รายการ</p>
                </div>
                <Link href="/pos" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                    🛒 ไปหน้า POS
                </Link>
            </div>

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
                <form method="get" action="/sales" className="flex gap-2">
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="from" value={from} />
                    <input type="hidden" name="to" value={to} />
                    <input type="text" name="search" defaultValue={searchQuery}
                        placeholder="🔍 ค้นหาเลขบิล หรือชื่อลูกค้า..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
                    <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600">ค้นหา</button>
                    {searchQuery && <a href={buildUrl({ search: '', page: '1' })} className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">ล้าง</a>}
                </form>
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
                                            {sale.items.map((item, i) => (
                                                <p key={i} className="text-xs text-gray-500">
                                                    {item.product.name} x{item.quantity} {item.unitName || item.product.unit}
                                                    {item.unitName && item.unitName !== item.product.unit && (() => {
                                                        const pu = (item.product as any).productUnits?.find((u: any) => u.unitName === item.unitName);
                                                        return pu ? ` (×${Number(pu.conversionRate)})` : '';
                                                    })()}
                                                </p>
                                            ))}
                                            {sale._count.items > 3 && (
                                                <p className="text-xs text-gray-400">+{sale._count.items - 3} รายการ</p>
                                            )}
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
