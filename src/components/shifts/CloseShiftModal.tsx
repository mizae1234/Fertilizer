'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { getShiftSummary, ShiftSummaryData } from '@/app/actions/shifts';

interface CloseShiftModalProps {
    open: boolean;
    shiftId: string;
    onClose: () => void;
    onConfirm: (data: { shiftId: string; closingCash?: number; notes?: string }) => Promise<void>;
    onPrint?: (shiftSummary: { shift: any; summary: ShiftSummaryData; closingCash: number; difference: number }) => void;
    loading?: boolean;
}

export default function CloseShiftModal({
    open,
    shiftId,
    onClose,
    onConfirm,
    onPrint,
    loading = false,
}: CloseShiftModalProps) {
    const [fetching, setFetching] = useState(true);
    const [shiftData, setShiftData] = useState<{ shift: any; summary: ShiftSummaryData } | null>(null);
    const [closingCash, setClosingCash] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && shiftId) {
            setFetching(true);
            setError('');
            getShiftSummary(shiftId)
                .then(data => {
                    setShiftData(data);
                    setClosingCash(data.summary.expectedCash);
                    setFetching(false);
                })
                .catch(err => {
                    setError(err.message || 'ไม่สามารถดึงข้อมูลกะได้');
                    setFetching(false);
                });
        }
    }, [open, shiftId]);

    if (!open) return null;

    const actualCash = typeof closingCash === 'number' ? closingCash : 0;
    const expectedCash = shiftData?.summary.expectedCash || 0;
    const difference = Math.round((actualCash - expectedCash) * 100) / 100;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await onConfirm({
                shiftId,
                closingCash: typeof closingCash === 'number' ? closingCash : undefined,
                notes: notes.trim() || undefined,
            });
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการปิดกะ');
        }
    };

    const handlePrintClick = () => {
        if (onPrint && shiftData) {
            onPrint({
                shift: shiftData.shift,
                summary: shiftData.summary,
                closingCash: actualCash,
                difference,
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🔒</span>
                            <div>
                                <h3 className="text-lg font-bold">ปิดกะการทำงาน</h3>
                                {shiftData && (
                                    <p className="text-xs text-rose-100">
                                        เลขที่กะ: {shiftData.shift.shiftNumber} | ผู้เปิด: {shiftData.shift.userName}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {fetching ? (
                        <div className="text-center py-10 text-gray-400">
                            <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
                            <p className="text-sm">กำลังคำนวณยอดขายของกะนี้...</p>
                        </div>
                    ) : error ? (
                        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                            {error}
                        </div>
                    ) : shiftData && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Shift timing info */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 flex justify-between items-center">
                                <div>
                                    <span className="text-gray-400 block">เวลาเปิดกะ:</span>
                                    <span className="font-semibold text-gray-800">{formatDateTime(shiftData.shift.openedAt)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-400 block">จำนวนบิลทั้งหมด:</span>
                                    <span className="font-semibold text-gray-800">{shiftData.summary.salesCount} บิล</span>
                                </div>
                            </div>

                            {/* Sales Breakdown by Payment Channel */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    📊 สรุปยอดขายตามช่องทางชำระเงิน
                                </h4>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* Cash */}
                                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between text-xs text-emerald-800 mb-1">
                                            <span className="font-medium">💵 เงินสด</span>
                                        </div>
                                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(shiftData.summary.cashSales)}</p>
                                    </div>

                                    {/* Transfer */}
                                    <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between text-xs text-blue-800 mb-1">
                                            <span className="font-medium">🏦 เงินโอน</span>
                                        </div>
                                        <p className="text-lg font-bold text-blue-700">{formatCurrency(shiftData.summary.transferSales)}</p>
                                    </div>

                                    {/* Cheque */}
                                    <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between text-xs text-purple-800 mb-1">
                                            <span className="font-medium">📑 เช็ค</span>
                                        </div>
                                        <p className="text-lg font-bold text-purple-700">{formatCurrency(shiftData.summary.chequeSales)}</p>
                                    </div>

                                    {/* Credit */}
                                    <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3">
                                        <div className="flex items-center justify-between text-xs text-amber-800 mb-1">
                                            <span className="font-medium">📋 ค้างชำระ (เครดิต)</span>
                                        </div>
                                        <p className="text-lg font-bold text-amber-700">{formatCurrency(shiftData.summary.creditSales)}</p>
                                    </div>
                                </div>

                                {/* Total Sales */}
                                <div className="mt-2.5 bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-700">ยอดขายรวมทั้งหมด</span>
                                    <span className="text-xl font-black text-gray-900">{formatCurrency(shiftData.summary.totalSales)}</span>
                                </div>
                            </div>

                            {/* Cash Drawer Reconciliation */}
                            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3">
                                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                    💰 การตรวจนับเงินสดในลิ้นชัก
                                </h4>
                                
                                <div className="space-y-1.5 text-xs text-gray-600">
                                    <div className="flex justify-between">
                                        <span>เงินทอนเริ่มต้น:</span>
                                        <span className="font-medium">{formatCurrency(shiftData.summary.startingCash)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>+ ยอดขายเงินสด:</span>
                                        <span className="font-medium text-emerald-600">+{formatCurrency(shiftData.summary.cashSales)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-amber-200 font-bold text-sm text-gray-800">
                                        <span>= เงินสดรวมในลิ้นชัก:</span>
                                        <span className="text-emerald-700">{formatCurrency(shiftData.summary.expectedCash)}</span>
                                    </div>
                                </div>

                                {/* Actual Cash Count Input */}
                                <div className="pt-2 border-t border-amber-200">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        💵 เงินสดที่นับได้จริง (บาท):
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            value={closingCash === '' ? '' : closingCash}
                                            onChange={e => setClosingCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-300 text-lg font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* Difference Display */}
                                    <div className="mt-2 flex justify-between items-center text-xs">
                                        <span className="font-medium text-gray-600">ส่วนต่าง (เกิน/ขาด):</span>
                                        <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                                            difference === 0
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : difference > 0
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-red-100 text-red-800'
                                        }`}>
                                            {difference === 0
                                                ? '✅ ยอดตรงพอดี'
                                                : difference > 0
                                                    ? `📈 เงินเกิน +${formatCurrency(difference)}`
                                                    : `📉 เงินขาด ${formatCurrency(difference)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Closing Notes */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    📝 หมายเหตุปิดกะ (ถ้ามี)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="เช่น เงินเหรียญยังไม่ได้นับ, ส่งต่อให้กะบ่าย"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                {onPrint && (
                                    <button
                                        type="button"
                                        onClick={handlePrintClick}
                                        className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                                    >
                                        🖨️ สลิปสรุป
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {loading ? 'กำลังปิดกะ...' : 'ยืนยันปิดกะ'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
