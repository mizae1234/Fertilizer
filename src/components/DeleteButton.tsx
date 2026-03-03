'use client';

import { useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';

interface DeleteButtonProps {
    id: string;
    name: string;
    entityLabel: string;
    deleteAction: (id: string) => Promise<void>;
}

export default function DeleteButton({ id, name, entityLabel, deleteAction }: DeleteButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title: string }>({
        open: false, message: '', type: 'success', title: '',
    });

    const handleDelete = async () => {
        setLoading(true);
        try {
            await deleteAction(id);
            setAlert({ open: true, message: `ลบ${entityLabel} "${name}" เรียบร้อย`, type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlert({ open: true, message: (error as Error).message, type: 'error', title: 'ไม่สามารถลบได้' });
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
            >
                ลบ
            </button>

            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleDelete}
                title={`ลบ${entityLabel}`}
                message={`ต้องการลบ${entityLabel} "${name}" ใช่หรือไม่?\nถ้ามี transaction แล้วจะไม่สามารถลบได้`}
                confirmText={loading ? 'กำลังลบ...' : 'ลบ'}
                variant="danger"
            />

            <AlertModal
                open={alert.open}
                onClose={() => setAlert(prev => ({ ...prev, open: false }))}
                message={alert.message}
                type={alert.type}
                title={alert.title}
            />
        </>
    );
}
