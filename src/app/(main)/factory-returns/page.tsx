import { getFactoryReturns } from '@/app/actions/factory-returns';
import Link from 'next/link';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import PageHeader from '@/components/PageHeader';

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string }> }

export default async function FactoryReturnsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
    const from = sp.from || defaultFrom();
    const to = sp.to || '';

    const { records, totalPages, total } = await getFactoryReturns(page, from, to);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), from, to, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
        return `/factory-returns?${p.toString()}`;
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="🔙 เคลมคืนโรงงาน"
                subtitle={`บันทึกการส่งสินค้าคืนผู้ส่งสินค้า/โรงงาน (${total} รายการ)`}
                actions={
                    <Link href="/factory-returns/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium text-sm hover:from-orange-600 hover:to-red-600 shadow-md shadow-orange-200 text-center">
                        + สร้างใบเคลมคืน
                    </Link>
                }
            />

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้ส่งสินค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการ</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่ารวม</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สร้างโดย</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                        ) : (
                            records.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3"><Link href={`/factory-returns/${r.id}`} className="text-sm font-medium text-orange-600 hover:underline">{r.returnNumber}</Link></td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{r.vendor.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{r._count.items} รายการ</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(r.totalAmount))}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{r.createdBy.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(r.createdAt)}</td>
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
                    records.map(r => (
                        <Link key={r.id} href={`/factory-returns/${r.id}`}
                            className="block bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-orange-600">{r.returnNumber}</span>
                                <span className="text-sm font-semibold text-gray-800">{formatCurrency(Number(r.totalAmount))}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 mb-1">{r.vendor.name}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{r._count.items} รายการ · {r.createdBy.name}</span>
                                <span>{formatDateTime(r.createdAt)}</span>
                            </div>
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
