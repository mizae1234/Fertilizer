'use client';

import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ShiftSummaryData } from '@/app/actions/shifts';

interface ShiftPrintSlipProps {
    open: boolean;
    onClose: () => void;
    shift: any;
    summary: ShiftSummaryData;
    closingCash: number;
    difference: number;
    shopName?: string;
}

export default function ShiftPrintSlip({
    open,
    onClose,
    shift,
    summary,
    closingCash,
    difference,
    shopName = 'ร้านปุ๋ยยา & การเกษตร',
}: ShiftPrintSlipProps) {
    if (!open) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Screen Header (Hidden on print) */}
                <div className="bg-gray-800 text-white px-5 py-3 flex items-center justify-between no-print shrink-0">
                    <span className="font-bold text-sm">🖨️ ตัวอย่างใบสรุปปิดกะ</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-bold transition-colors"
                        >
                            พิมพ์
                        </button>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="p-4 overflow-y-auto text-black font-mono text-xs leading-relaxed bg-white">
                    <style jsx global>{`
                        @page {
                            size: 80mm auto;
                            margin: 0 !important;
                        }
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #shift-print-slip, #shift-print-slip * {
                                visibility: visible;
                            }
                            #shift-print-slip {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 80mm;
                                margin: 0 auto;
                                padding: 2mm 4mm;
                                box-sizing: border-box;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    `}</style>

                    <div id="shift-print-slip" className="max-w-[76mm] mx-auto">
                        {/* Slip Title */}
                        <div className="text-center pb-2 mb-2 border-b border-dashed border-gray-400">
                            <h2 className="text-base font-bold">{shopName}</h2>
                            <p className="text-[13px] font-bold mt-0.5">ใบสรุปยอดปิดกะ (SHIFT SUMMARY)</p>
                            <p className="text-[11px] text-gray-600 mt-0.5">เลขที่: {shift.shiftNumber}</p>
                        </div>

                        {/* Shift Info */}
                        <div className="space-y-0.5 pb-2 mb-2 border-b border-dashed border-gray-400 text-[11px]">
                            <div className="flex justify-between">
                                <span>พนักงาน:</span>
                                <span className="font-bold">{shift.userName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>เปิดกะ:</span>
                                <span>{formatDateTime(shift.openedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ปิดกะ:</span>
                                <span>{formatDateTime(new Date())}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>จำนวนบิล:</span>
                                <span className="font-bold">{summary.salesCount} บิล</span>
                            </div>
                        </div>

                        {/* Sales Breakdown */}
                        <div className="pb-2 mb-2 border-b border-dashed border-gray-400 space-y-1">
                            <p className="font-bold text-[11px] mb-1">ยอดขายตามช่องทาง:</p>
                            <div className="flex justify-between">
                                <span>💵 เงินสด:</span>
                                <span className="font-bold">{formatCurrency(summary.cashSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>🏦 เงินโอน:</span>
                                <span className="font-bold">{formatCurrency(summary.transferSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>📑 เช็ค:</span>
                                <span className="font-bold">{formatCurrency(summary.chequeSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>📋 ค้างชำระ:</span>
                                <span className="font-bold">{formatCurrency(summary.creditSales)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-dotted border-gray-300 font-bold text-sm">
                                <span>รวมยอดขาย:</span>
                                <span>{formatCurrency(summary.totalSales)}</span>
                            </div>
                        </div>

                        {/* Cash Drawer Reconciliation */}
                        <div className="pb-2 mb-2 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                            <p className="font-bold mb-1">การตรวจนับเงินสด:</p>
                            <div className="flex justify-between">
                                <span>เงินทอนเริ่มต้น:</span>
                                <span>{formatCurrency(summary.startingCash)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>+ ขายเงินสด:</span>
                                <span>+{formatCurrency(summary.cashSales)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>เงินสดรวมในลิ้นชัก:</span>
                                <span>{formatCurrency(summary.expectedCash)}</span>
                            </div>
                            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-300">
                                <span>เงินสดนับได้จริง:</span>
                                <span>{formatCurrency(closingCash)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-[12px] pt-0.5">
                                <span>ส่วนต่าง (ขาด/เกิน):</span>
                                <span className={difference === 0 ? '' : difference > 0 ? 'text-blue-600' : 'text-red-600'}>
                                    {difference === 0 ? '0 (ตรงพอดี)' : difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                                </span>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="pt-4 text-center space-y-6 text-[10px]">
                            <div className="flex justify-between">
                                <div className="text-center w-1/2">
                                    <div className="border-b border-dotted border-gray-400 pb-6 mb-1"></div>
                                    <p>ลงชื่อผู้ส่งกะ</p>
                                    <p>({shift.userName})</p>
                                </div>
                                <div className="text-center w-1/2 pl-4">
                                    <div className="border-b border-dotted border-gray-400 pb-6 mb-1"></div>
                                    <p>ลงชื่อผู้รับกะ/ผู้ตรวจ</p>
                                    <p>(.........................)</p>
                                </div>
                            </div>
                            <p className="text-[9px] text-gray-500">พิมพ์เมื่อ: {formatDateTime(new Date())}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
