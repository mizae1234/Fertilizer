import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import PageHeader from '@/components/PageHeader';

interface Props { searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string }> }

export default async function GoodsReceivePage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const status = sp.status || '';
    const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
    const from = sp.from || defaultFrom();
    const to = sp.to || '';
    const perPage = 10;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
    }

    const [records, total] = await Promise.all([
        prisma.goodsReceive.findMany({
            where,
            include: {
                vendor: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.goodsReceive.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), status, from, to, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
        return `/goods-receive?${p.toString()}`;
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="นำเข้าสินค้า"
                subtitle="บันทึกการนำเข้าสินค้าเข้าคลัง"
                actions={
                    <Link href="/goods-receive/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 text-center">
                        + บันทึกนำเข้าสินค้า
                    </Link>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Status Filter */}
                    <div className="flex flex-wrap gap-2">
                        {[{ v: '', l: 'ทั้งหมด' }, { v: 'PENDING', l: 'รอตรวจสอบ' }, { v: 'APPROVED', l: 'รับแล้ว' }, { v: 'REJECTED', l: 'ปฏิเสธ' }].map(f => (
                            <Link key={f.v} href={buildUrl({ status: f.v, page: '1' })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === f.v || (!status && !f.v) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่ GR</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้ขาย</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">มูลค่า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">บันทึกโดย</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                        ) : (
                            records.map(gr => (
                                <tr key={gr.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3"><Link href={`/goods-receive/${gr.id}`} className="text-sm font-medium text-emerald-600 hover:underline">{gr.grNumber}</Link></td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{gr.vendor.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{gr._count.items} รายการ</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{formatCurrency(Number(gr.totalAmount))}</td>
                                    <td className="px-4 py-3"><StatusBadge status={gr.status} /></td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{gr.createdBy.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(gr.createdAt)}</td>
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {records.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow-md border border-gray-100">ไม่พบรายการ</div>
                ) : (
                    records.map(gr => (
                        <Link key={gr.id} href={`/goods-receive/${gr.id}`}
                            className="block bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-emerald-600">{gr.grNumber}</span>
                                <StatusBadge status={gr.status} />
                            </div>
                            <p className="text-sm font-medium text-gray-800 mb-1">{gr.vendor.name}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{gr._count.items} รายการ · {gr.createdBy.name}</span>
                                <span className="font-semibold text-gray-800 text-sm">{formatCurrency(Number(gr.totalAmount))}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{formatDateTime(gr.createdAt)}</p>
                        </Link>
                    ))
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-sm text-gray-500">หน้า {page}/{totalPages}</p>
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
