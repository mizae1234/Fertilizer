'use client';

import { useState } from 'react';
import { cancelStockWithdrawal } from '@/app/actions/stock-withdrawals';
import { useRouter } from 'next/navigation';
import AlertModal from '@/components/AlertModal';

export default function CancelWithdrawalButton({ id, withdrawalNumber }: { id: string; withdrawalNumber: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const handleCancel = async () => {
        if (!confirm(`ยืนยันยกเลิกใบเบิกสินค้า ${withdrawalNumber}?\n\nStock ที่ถูกตัดออกจะถูกคืนกลับ`)) return;
        setLoading(true);
        try {
            await cancelStockWithdrawal(id);
            setAlertModal({ open: true, message: `ยกเลิกใบเบิกสินค้า ${withdrawalNumber} เรียบร้อย\nStock ถูกคืนกลับแล้ว`, type: 'success', title: 'ยกเลิกสำเร็จ' });
            setTimeout(() => router.refresh(), 1500);
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
                {loading ? '⏳ กำลังยกเลิก...' : '❌ ยกเลิกบิล'}
            </button>
            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </>
    );
}
