'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface OpenShiftModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (startingCash: number, notes?: string) => Promise<void>;
    loading?: boolean;
    userName?: string;
}

export default function OpenShiftModal({
    open,
    onClose,
    onConfirm,
    loading = false,
    userName,
}: OpenShiftModalProps) {
    const [startingCash, setStartingCash] = useState<number | ''>(0);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const cash = typeof startingCash === 'number' ? startingCash : 0;
        if (cash < 0) {
            setError('เงินทอนเริ่มต้นต้องไม่ติดลบ');
            return;
        }

        try {
            await onConfirm(cash, notes);
            setStartingCash(0);
            setNotes('');
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการเปิดกะ');
        }
    };

    const quickAmounts = [0, 500, 1000, 1500, 2000, 3000];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">⏰</span>
                            <div>
                                <h3 className="text-lg font-bold">เปิดกะเข้างาน</h3>
                                {userName && <p className="text-xs text-emerald-100">ผู้ใช้งาน: {userName}</p>}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                            {error}
                        </div>
                    )}

                    {/* Starting Cash */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            💵 เงินทอนเริ่มต้น (บาท)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                            <input
                                type="number"
                                autoFocus
                                step="any"
                                min="0"
                                value={startingCash === '' ? '' : startingCash}
                                onChange={e => setStartingCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="0.00"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-300 text-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                        {/* Quick preset amounts */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {quickAmounts.map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setStartingCash(amt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        startingCash === amt
                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                                    }`}
                                >
                                    {amt === 0 ? 'ไม่มีเงินทอน' : formatCurrency(amt)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            📝 หมายเหตุ (ถ้ามี)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="เช่น กะเช้า, เคาน์เตอร์ 1"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {loading ? 'กำลังเปิดกะ...' : 'ยืนยันเปิดกะ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
