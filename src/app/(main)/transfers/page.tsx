import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import PageHeader from '@/components/PageHeader';

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
                    <div className="flex gap-2">
                        {[{ v: '', l: 'ทั้งหมด' }, { v: 'PENDING', l: 'รออนุมัติ' }, { v: 'APPROVED', l: 'อนุมัติแล้ว' }, { v: 'REJECTED', l: 'ปฏิเสธ' }].map(f => (
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
                            transfers.map(tf => (
                                <tr key={tf.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3"><Link href={`/transfers/${tf.id}`} className="text-sm font-medium text-emerald-600 hover:underline">{tf.transferNumber}</Link></td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{tf.fromWarehouse.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{tf.toWarehouse.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{tf._count.items} รายการ</td>
                                    <td className="px-4 py-3"><StatusBadge status={tf.status} /></td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{tf.createdBy.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(tf.createdAt)}</td>
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
