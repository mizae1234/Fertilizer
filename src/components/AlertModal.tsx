'use client';

import { useEffect, useRef } from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    type?: AlertType;
    confirmLabel?: string;
}

const icons: Record<AlertType, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

const colors: Record<AlertType, { bg: string; border: string; btn: string }> = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    error: { bg: 'bg-red-50', border: 'border-red-200', btn: 'bg-red-600 hover:bg-red-700' },
    warning: { bg: 'bg-orange-50', border: 'border-orange-200', btn: 'bg-orange-600 hover:bg-orange-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', btn: 'bg-blue-600 hover:bg-blue-700' },
};

export default function AlertModal({
    open,
    onClose,
    title,
    message,
    type = 'info',
    confirmLabel = 'ตกลง',
}: AlertModalProps) {
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            btnRef.current?.focus();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const c = colors[type];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full max-w-sm rounded-2xl border ${c.border} ${c.bg} bg-white shadow-2xl overflow-hidden animate-scale-in`}
            >
                <div className="p-6 text-center">
                    <div className="text-4xl mb-3">{icons[type]}</div>
                    {title && (
                        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{message}</p>
                </div>
                <div className="px-6 pb-5">
                    <button
                        ref={btnRef}
                        onClick={onClose}
                        className={`w-full py-2.5 rounded-xl text-white font-medium text-sm ${c.btn} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
