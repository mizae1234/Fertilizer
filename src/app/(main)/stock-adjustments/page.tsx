import { getStockAdjustments } from '@/app/actions/stock-adjustments';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Suspense } from 'react';
import AdjustmentFilter from './AdjustmentFilter';

interface Props { searchParams: Promise<{ page?: string; search?: string }> }

export default async function StockAdjustmentsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const search = sp.search || '';

    const { records, totalPages, total } = await getStockAdjustments(page, search);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = { page: String(page), search, ...params };
        Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v); });
        return `/stock-adjustments?${p.toString()}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ปรับปรุง Stock</h1>
                    <p className="text-sm text-gray-500 mt-1">บันทึกเพิ่ม/ลด stock สินค้า ({total} รายการ)</p>
                </div>
                <Link href="/stock-adjustments/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium text-sm hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-200 text-center">
                    + บันทึกปรับปรุง Stock
                </Link>
            </div>

            <Suspense fallback={<div className="mb-4 h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                <AdjustmentFilter />
            </Suspense>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">คลัง</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวน</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เหตุผล</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                        ) : (
                            records.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-red-600">{r.reference}</td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium text-gray-800">{r.product.name}</p>
                                        <p className="text-xs text-gray-400">{r.product.code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{r.warehouse.name}</td>
                                    <td className={`px-4 py-3 text-sm font-semibold text-right ${r.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.quantity >= 0 ? '+' : ''}{r.quantity} {r.product.unit}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(Math.abs(r.quantity) * Number(r.unitCost))}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{r.notes || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.createdAt)}</td>
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
                        <div key={r.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-red-600">{r.reference}</span>
                                <span className={`text-sm font-bold ${r.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.quantity >= 0 ? '+' : ''}{r.quantity} {r.product.unit}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 mb-1">{r.product.name}</p>
                            <p className="text-xs text-gray-400 mb-2">{r.product.code} · {r.warehouse.name}</p>
                            {r.notes && <p className="text-xs text-gray-500 mb-2">💬 {r.notes}</p>}
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>{formatDate(r.createdAt)}</span>
                                <span className="text-gray-600">{formatCurrency(Math.abs(r.quantity) * Number(r.unitCost))}</span>
                            </div>
                        </div>
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
