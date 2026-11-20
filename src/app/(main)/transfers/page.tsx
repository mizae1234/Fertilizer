import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';

interface Props { searchParams: Promise<{ page?: string; status?: string; from?: string; to?: string }> }

export default async function TransfersPage({ searchParams }: Props) {
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

    const [transfers, total] = await Promise.all([
        prisma.stockTransfer.findMany({
            where,
            include: {
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
                createdBy: { select: { name: true } },
                cancelledBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.stockTransfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), status, from, to, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
        return `/transfers?${p.toString()}`;
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="โอนสินค้า"
                subtitle="จัดการเอกสารโอนสินค้าระหว่างคลัง"
                actions={
                    <Link href="/transfers/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                        + สร้างใบโอน
                    </Link>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { v: '', l: 'ทั้งหมด' },
                            { v: 'PENDING', l: 'รออนุมัติ' },
                            { v: 'APPROVED', l: 'อนุมัติแล้ว' },
                            { v: 'REJECTED', l: 'ปฏิเสธ' },
                            { v: 'CANCELLED', l: 'ยกเลิกแล้ว' },
                        ].map(f => (
                            <Link key={f.v} href={buildUrl({ status: f.v, page: '1' })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === f.v || (!status && !f.v) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {f.l}
                            </Link>
                        ))}
                    </div>
                    <Suspense fallback={<div className="ml-auto h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />}>
                        <DateRangeFilter />
                    </Suspense>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">จาก</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ไป</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สร้างโดย</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transfers.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                            ) : (
                                transfers.map(tf => {
                                    const isCancelled = tf.status === 'CANCELLED';
                                    return (
                                        <tr key={tf.id} className={`hover:bg-gray-50 ${isCancelled ? 'bg-rose-50/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/transfers/${tf.id}`}
                                                    className={`text-sm font-medium hover:underline ${isCancelled ? 'line-through text-rose-500' : 'text-emerald-600'}`}
                                                >
                                                    {tf.transferNumber}
                                                </Link>
                                                {isCancelled && tf.cancelReason && (
                                                    <p className="text-xs text-rose-500 mt-0.5 truncate max-w-[220px]" title={tf.cancelReason}>
                                                        เหตุผล: {tf.cancelReason}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{tf.fromWarehouse.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{tf.toWarehouse.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{tf._count.items} รายการ</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={tf.status} />
                                                {isCancelled && tf.cancelledBy?.name && (
                                                    <p className="text-[11px] text-rose-500 mt-0.5">
                                                        ยกเลิกโดย {tf.cancelledBy.name}
                                                        {tf.cancelledAt ? ` (${formatDateTime(tf.cancelledAt)})` : ''}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{tf.createdBy.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(tf.createdAt)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/transfers" params={{ status, from, to }} />
                )}
            </div>
        </div>
    );
}
