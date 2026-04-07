import { getStockWithdrawals } from '@/app/actions/stock-withdrawals';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string }> }

export default async function StockWithdrawalsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
    const from = sp.from || defaultFrom();
    const to = sp.to || '';

    const { records, totalPages, total } = await getStockWithdrawals(page, from, to);

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="📤 เบิกสินค้า"
                subtitle={`บันทึกการเบิกสินค้าออกจากคลัง (${total} รายการ)`}
                actions={
                    <Link href="/stock-withdrawals/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium text-sm hover:from-violet-600 hover:to-purple-600 shadow-md shadow-violet-200 text-center">
                        + สร้างใบเบิกสินค้า
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้เบิกสินค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
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
                                    <td className="px-4 py-3"><Link href={`/stock-withdrawals/${r.id}`} className="text-sm font-medium text-violet-600 hover:underline">{r.withdrawalNumber}</Link></td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{r.requesterName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{r._count.items} รายการ</td>
                                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{r.createdBy.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(r.createdAt)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/stock-withdrawals" params={{ from, to }} />
                )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {records.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow-md border border-gray-100">ไม่พบรายการ</div>
                ) : (
                    records.map(r => (
                        <Link key={r.id} href={`/stock-withdrawals/${r.id}`}
                            className="block bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-violet-600">{r.withdrawalNumber}</span>
                                <StatusBadge status={r.status} />
                            </div>
                            <p className="text-sm font-medium text-gray-800 mb-1">ผู้เบิก: {r.requesterName}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{r._count.items} รายการ</span>
                                <span>{formatDateTime(r.createdAt)}</span>
                            </div>
                        </Link>
                    ))
                )}
                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/stock-withdrawals" params={{ from, to }} />
                )}
            </div>
        </div>
    );
}
