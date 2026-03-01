'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Quotation {
    id: string;
    quotationNumber: string;
    status: string;
    totalAmount: string;
    discount: string;
    customerName: string | null;
    validUntil: string | null;
    createdAt: string;
    customer: { name: string; phone: string } | null;
    createdBy: { name: string };
    _count: { items: number };
}

const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SENT: 'bg-blue-100 text-blue-700',
    ACCEPTED: 'bg-emerald-100 text-emerald-700',
    EXPIRED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
    DRAFT: '📝 ร่าง',
    SENT: '📨 ส่งแล้ว',
    ACCEPTED: '✅ ยอมรับ',
    EXPIRED: '⏰ หมดอายุ',
};

export default function QuotationsPage() {
    const router = useRouter();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/quotations?${params.toString()}`);
        const data = await res.json();
        setQuotations(data.quotations || []);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
    }, [page, search, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div className="animate-fade-in">
            <PageHeader title="📋 ใบเสนอราคา" subtitle="จัดการใบเสนอราคาทั้งหมด" />

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="🔍 ค้นหาเลขที่ / ชื่อลูกค้า..."
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                    <option value="">ทุกสถานะ</option>
                    <option value="DRAFT">ร่าง</option>
                    <option value="SENT">ส่งแล้ว</option>
                    <option value="ACCEPTED">ยอมรับ</option>
                    <option value="EXPIRED">หมดอายุ</option>
                </select>
                <button
                    onClick={() => router.push('/quotations/new')}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 shadow-md shadow-emerald-200"
                >
                    + สร้างใบเสนอราคา
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : quotations.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">ไม่มีข้อมูล</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ลูกค้า</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ยอดรวม</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่สร้าง</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">หมดอายุ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {quotations.map(q => (
                                <tr key={q.id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => router.push(`/quotations/${q.id}`)}>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-semibold text-emerald-600">{q.quotationNumber}</p>
                                        <p className="text-xs text-gray-400">{q._count.items} รายการ</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        {q.customer?.name || q.customerName || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                                        {formatCurrency(Number(q.totalAmount))}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[q.status] || 'bg-gray-100'}`}>
                                            {statusLabels[q.status] || q.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(q.createdAt)}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {q.validUntil ? formatDateTime(q.validUntil) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {p}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
