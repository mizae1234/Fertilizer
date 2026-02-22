'use client';

import { cn } from '@/lib/utils';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'success' | 'danger' | 'primary';
    loading?: boolean;
    children?: React.ReactNode;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    variant = 'success',
    loading = false,
    children,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-200">
                <div className="text-center">
                    <div
                        className={cn(
                            'w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4',
                            variant === 'success' ? 'bg-emerald-100' : variant === 'primary' ? 'bg-amber-100' : 'bg-red-100'
                        )}
                    >
                        <span className="text-2xl">{variant === 'success' ? '✓' : variant === 'primary' ? '🎁' : '✕'}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
                    {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
                    {children}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={cn(
                            'flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-white transition-colors disabled:opacity-50',
                            variant === 'danger'
                                ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                                : variant === 'primary'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                        )}
                    >
                        {loading ? 'กำลังดำเนินการ...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
