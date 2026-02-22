'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveGoodsReceive, rejectGoodsReceive } from '@/app/actions/goods-receive';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';

export default function GoodsReceiveActions({ id }: { id: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState('');
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' }>({ open: false, message: '', type: 'error' });

    const handleApprove = async () => {
        setLoading('approve');
        try {
            await approveGoodsReceive(id);
            router.refresh();
        } catch (error) {
            console.error(error);
            setAlertModal({ open: true, message: 'ไม่สามารถอนุมัติรายการได้ กรุณาลองใหม่', type: 'error' });
        } finally {
            setLoading('');
            setShowApprove(false);
        }
    };

    const handleReject = async () => {
        setLoading('reject');
        try {
            await rejectGoodsReceive(id);
            router.refresh();
        } catch (error) {
            console.error(error);
            setAlertModal({ open: true, message: 'ไม่สามารถปฏิเสธรายการได้ กรุณาลองใหม่', type: 'error' });
        } finally {
            setLoading('');
            setShowReject(false);
        }
    };

    return (
        <>
            <div className="flex gap-3">
                <button
                    onClick={() => setShowReject(true)}
                    disabled={loading !== ''}
                    className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 disabled:opacity-50"
                >
                    {loading === 'reject' ? 'กำลังดำเนินการ...' : '❌ ปฏิเสธ'}
                </button>
                <button
                    onClick={() => setShowApprove(true)}
                    disabled={loading !== ''}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                >
                    {loading === 'approve' ? 'กำลังดำเนินการ...' : '✅ อนุมัติรับสินค้า'}
                </button>
            </div>

            <ConfirmModal
                isOpen={showApprove}
                onClose={() => setShowApprove(false)}
                onConfirm={handleApprove}
                title="ยืนยันรับสินค้าเข้าคลัง"
                message="สินค้าจะถูกเพิ่มเข้า Stock ทันที ยืนยันดำเนินการ?"
                confirmText="อนุมัติ"
                variant="success"
                loading={loading === 'approve'}
            />
            <ConfirmModal
                isOpen={showReject}
                onClose={() => setShowReject(false)}
                onConfirm={handleReject}
                title="ยืนยันปฏิเสธการรับสินค้า"
                message="ยืนยันปฏิเสธรายการรับสินค้านี้?"
                confirmText="ปฏิเสธ"
                variant="danger"
                loading={loading === 'reject'}
            />
            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title="เกิดข้อผิดพลาด"
            />
        </>
    );
}
