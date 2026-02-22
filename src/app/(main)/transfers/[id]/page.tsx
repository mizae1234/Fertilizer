'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { approveTransfer, rejectTransfer } from '@/app/actions/transfers';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatDate } from '@/lib/utils';

interface TransferDetail {
    id: string; transferNumber: string; status: string; notes: string | null; createdAt: string;
    fromWarehouse: { name: string }; toWarehouse: { name: string };
    createdBy: { name: string };
    items: {
        id: string; quantity: number;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

export default function TransferDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [transfer, setTransfer] = useState<TransferDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

    useEffect(() => {
        fetch(`/api/transfers/${params.id}`).then(r => r.json()).then(data => { setTransfer(data); setLoading(false); });
    }, [params.id]);

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await approveTransfer(params.id as string);
            window.location.reload();
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally { setActionLoading(false); setShowApprove(false); }
    };

    const handleReject = async () => {
        setActionLoading(true);
        try {
            await rejectTransfer(params.id as string);
            window.location.reload();
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally { setActionLoading(false); setShowReject(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">กำลังโหลด...</div></div>;
    if (!transfer) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{transfer.transferNumber}</h1>
                    <p className="text-sm text-gray-500 mt-1">เอกสารโอนสินค้า</p>
                </div>
                <StatusBadge status={transfer.status} className="text-sm px-3 py-1.5" />
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-500">จากคลัง</p><p className="text-sm font-medium text-gray-800">{transfer.fromWarehouse.name}</p></div>
                    <div><p className="text-xs text-gray-500">ไปคลัง</p><p className="text-sm font-medium text-gray-800">{transfer.toWarehouse.name}</p></div>
                    <div><p className="text-xs text-gray-500">สร้างโดย</p><p className="text-sm text-gray-800">{transfer.createdBy.name}</p></div>
                    <div><p className="text-xs text-gray-500">วันที่สร้าง</p><p className="text-sm text-gray-800">{formatDate(transfer.createdAt)}</p></div>
                </div>
                {transfer.notes && <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-xs text-gray-500">หมายเหตุ</p><p className="text-sm text-gray-800">{transfer.notes}</p></div>}
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">รายการสินค้า ({transfer.items.length} รายการ)</h2></div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวน</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {transfer.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                <td className="px-4 py-3"><p className="text-sm font-medium text-gray-800">{item.product.name}</p><p className="text-xs text-gray-400">{item.product.code}</p></td>
                                <td className="px-4 py-3 text-sm text-gray-800 text-right">{item.quantity} {item.product.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {transfer.status === 'PENDING' && (
                <div className="flex gap-3">
                    <button onClick={() => setShowReject(true)} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium text-sm hover:from-red-600 hover:to-rose-600">ปฏิเสธ</button>
                    <button onClick={() => setShowApprove(true)} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">อนุมัติ</button>
                </div>
            )}

            <ConfirmModal isOpen={showApprove} onClose={() => setShowApprove(false)} onConfirm={handleApprove} title="ยืนยันการอนุมัติ" message={`ยืนยันอนุมัติ ${transfer.transferNumber}? สินค้าจะถูกโอนจาก ${transfer.fromWarehouse.name} ไปยัง ${transfer.toWarehouse.name}`} confirmText="อนุมัติ" variant="success" loading={actionLoading} />
            <ConfirmModal isOpen={showReject} onClose={() => setShowReject(false)} onConfirm={handleReject} title="ยืนยันการปฏิเสธ" message={`ยืนยันปฏิเสธ ${transfer.transferNumber}?`} confirmText="ปฏิเสธ" variant="danger" loading={actionLoading} />
            <AlertModal open={alertModal.open} onClose={() => setAlertModal({ open: false, message: '' })} message={alertModal.message} type="error" title="เกิดข้อผิดพลาด" />
        </div>
    );
}
