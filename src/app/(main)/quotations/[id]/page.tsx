'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { updateQuotation, deleteQuotation } from '@/app/actions/quotations';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

interface QuotationDetail {
    id: string;
    quotationNumber: string;
    status: string;
    totalAmount: string;
    discount: string;
    customerName: string | null;
    validUntil: string | null;
    notes: string | null;
    createdAt: string;
    customer: { name: string; phone: string; address: string | null } | null;
    createdBy: { name: string };
    items: {
        id: string; quantity: number; unitPrice: string; totalPrice: string; unitName: string | null;
        product: { name: string; code: string; unit: string };
    }[];
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

export default function QuotationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const user = useUser();

    const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDelete, setShowDelete] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    const showAlert = useCallback((msg: string, type: 'success' | 'error' = 'error', title?: string) => {
        setAlertModal({ open: true, message: msg, type, title });
    }, []);

    const fetchData = useCallback(async () => {
        const data = await fetch(`/api/quotations/${id}`).then(r => r.json());
        setQuotation(data);
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleStatusChange = async (newStatus: string) => {
        setActionLoading('status');
        try {
            await updateQuotation(id, { status: newStatus });
            await fetchData();
            showAlert('อัพเดทสถานะเรียบร้อย', 'success', 'สำเร็จ');
        } catch (error) { showAlert((error as Error).message, 'error'); }
        finally { setActionLoading(''); }
    };

    const handleDelete = async () => {
        setActionLoading('delete');
        try {
            await deleteQuotation(id);
            router.push('/quotations');
        } catch (error) { showAlert((error as Error).message, 'error'); }
        finally { setActionLoading(''); setShowDelete(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!quotation) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>;

    const discount = Number(quotation.discount || 0);
    const totalAmount = Number(quotation.totalAmount);
    const subtotal = totalAmount + discount;
    const custName = quotation.customer?.name || quotation.customerName || 'ไม่ระบุ';

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <button onClick={() => router.push('/quotations')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                กลับรายการใบเสนอราคา
            </button>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{quotation.quotationNumber}</h1>
                    <p className="text-sm text-gray-500 mt-1">ใบเสนอราคา</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${statusColors[quotation.status] || 'bg-gray-100'}`}>
                        {statusLabels[quotation.status] || quotation.status}
                    </span>
                    <button onClick={() => router.push(`/quotations/${id}/edit`)}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100">
                        ✏️ แก้ไข
                    </button>
                    <button onClick={() => window.open(`/quotation-print/${id}`, '_blank')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100">
                        🖨️ พิมพ์ PDF
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">ลูกค้า</p>
                        <p className="text-sm font-medium text-gray-800">{custName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">มูลค่ารวม</p>
                        <p className="text-sm font-semibold text-gray-800">{formatCurrency(totalAmount)}</p>
                        {discount > 0 && <p className="text-xs text-red-500 mt-0.5">ส่วนลด: -{formatCurrency(discount)}</p>}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">วันที่สร้าง</p>
                        <p className="text-sm text-gray-800">{formatDateTime(quotation.createdAt)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">หมดอายุ</p>
                        <p className="text-sm text-gray-800">{quotation.validUntil ? formatDateTime(quotation.validUntil) : '-'}</p>
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">รายการสินค้า ({quotation.items.length} รายการ)</h2>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวน</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ราคา/หน่วย</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">รวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {quotation.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                                    <p className="text-xs text-gray-400">{item.product.code}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800 text-right">
                                    {item.quantity} {item.unitName || item.product.unit}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(item.totalPrice))}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {discount > 0 && (<>
                            <tr className="border-t border-gray-200">
                                <td colSpan={4} className="px-4 py-2 text-right text-sm text-gray-600">ยอดรวมก่อนส่วนลด</td>
                                <td className="px-4 py-2 text-right text-sm text-gray-600">{formatCurrency(subtotal)}</td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="px-4 py-2 text-right text-sm text-red-500 font-medium">ส่วนลด</td>
                                <td className="px-4 py-2 text-right text-sm text-red-500 font-medium">-{formatCurrency(discount)}</td>
                            </tr>
                        </>)}
                        <tr className="border-t-2 border-gray-200">
                            <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-800">รวมทั้งสิ้น</td>
                            <td className="px-4 py-3 text-right text-lg font-bold text-emerald-600">{formatCurrency(totalAmount)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Notes */}
            {quotation.notes && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">📝 หมายเหตุ</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
                </div>
            )}

            {/* Status Actions */}
            {user?.role === 'ADMIN' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">🔄 เปลี่ยนสถานะ</h3>
                    <div className="flex flex-wrap gap-2">
                        {quotation.status !== 'SENT' && (
                            <button onClick={() => handleStatusChange('SENT')} disabled={actionLoading !== ''}
                                className="px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 disabled:opacity-50">
                                📨 ส่งแล้ว
                            </button>
                        )}
                        {quotation.status !== 'ACCEPTED' && (
                            <button onClick={() => handleStatusChange('ACCEPTED')} disabled={actionLoading !== ''}
                                className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50">
                                ✅ ยอมรับ
                            </button>
                        )}
                        {quotation.status !== 'EXPIRED' && (
                            <button onClick={() => handleStatusChange('EXPIRED')} disabled={actionLoading !== ''}
                                className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                                ⏰ หมดอายุ
                            </button>
                        )}
                        {quotation.status !== 'DRAFT' && (
                            <button onClick={() => handleStatusChange('DRAFT')} disabled={actionLoading !== ''}
                                className="px-4 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 disabled:opacity-50">
                                📝 กลับเป็นร่าง
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Delete */}
            {quotation.status === 'DRAFT' && user?.role === 'ADMIN' && (
                <button onClick={() => setShowDelete(true)} disabled={actionLoading !== ''}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors">
                    🗑️ ลบใบเสนอราคา
                </button>
            )}

            {/* Modals */}
            <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete}
                title="ยืนยันลบใบเสนอราคา" message={`ต้องการลบ ${quotation.quotationNumber} ใช่หรือไม่?`}
                confirmText="ลบ" variant="danger" loading={actionLoading === 'delete'} />
            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
