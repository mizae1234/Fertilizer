'use client';

import { useState, useEffect } from 'react';
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
    shopName,
}: ShiftPrintSlipProps) {
    const [fetchedShopName, setFetchedShopName] = useState<string>('');

    useEffect(() => {
        if (!open || shopName || shift?.shopName) return;
        Promise.all([
            fetch('/api/shop-info').then(r => r.json()).catch(() => null),
            fetch('/api/receipt-template').then(r => r.json()).catch(() => null),
        ]).then(([info, templates]) => {
            const fromShopInfo = info?.name?.trim();
            const tplList = Array.isArray(templates) ? templates : [];
            const defTpl = tplList.find((t: any) => t.isDefault) || tplList[0];
            const fromHeader = defTpl?.headerText?.split('\n').map((l: string) => l.trim()).find(Boolean);
            const fromTplName = defTpl?.name && defTpl.name !== 'Default' ? defTpl.name.trim() : '';
            setFetchedShopName(fromShopInfo || fromHeader || fromTplName || 'ร้านค้า');
        });
    }, [open, shopName, shift?.shopName]);

    if (!open) return null;

    const displayShopName = shopName || shift?.shopName || fetchedShopName || 'ร้านค้า';

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
                <div className="p-4 overflow-y-auto text-black text-xs leading-relaxed bg-white" style={{ fontFamily: "'Sarabun', 'Tahoma', sans-serif" }}>
                    <style jsx global>{`
                        @page {
                            size: 80mm auto;
                            margin: 0 !important;
                        }
                        @media print {
                            *, *::before, *::after {
                                box-sizing: border-box !important;
                            }
                            html, body {
                                width: 100% !important;
                                max-width: 80mm !important;
                                margin: 0 auto !important;
                                padding: 0 !important;
                                background: #fff !important;
                            }
                            body * {
                                visibility: hidden;
                            }
                            #shift-print-slip, #shift-print-slip * {
                                visibility: visible;
                            }
                            #shift-print-slip {
                                position: absolute;
                                left: 0;
                                right: 0;
                                top: 0;
                                width: 72mm !important;
                                max-width: 72mm !important;
                                margin: 0 auto !important;
                                padding: 3mm 4mm 5mm 4mm !important;
                                box-sizing: border-box !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    `}</style>

                    <div id="shift-print-slip" className="max-w-[72mm] mx-auto px-2">
                        {/* Slip Title */}
                        <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
                            <h2 className="text-[16px] font-bold leading-snug">{displayShopName}</h2>
                            <p className="text-[13px] font-bold mt-0.5">ใบสรุปยอดปิดกะ (SHIFT SUMMARY)</p>
                            <p className="text-[11.5px] text-gray-800 mt-0.5">เลขที่: {shift.shiftNumber}</p>
                        </div>

                        {/* Shift Info */}
                        <div className="space-y-0.5 pb-2 mb-2 border-b border-dashed border-black text-[12px]">
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
                                <span>{formatDateTime(shift.closedAt || new Date())}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>จำนวนบิล:</span>
                                <span className="font-bold">{summary.salesCount} บิล</span>
                            </div>
                        </div>

                        {/* Sales Breakdown */}
                        <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 text-[12.5px]">
                            <p className="font-bold text-[12px] mb-1">ยอดขายตามช่องทาง:</p>
                            <div className="flex justify-between">
                                <span>• เงินสด:</span>
                                <span className="font-bold">{formatCurrency(summary.cashSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>• เงินโอน:</span>
                                <span className="font-bold">{formatCurrency(summary.transferSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>• เช็ค:</span>
                                <span className="font-bold">{formatCurrency(summary.chequeSales)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>• ค้างชำระ:</span>
                                <span className="font-bold">{formatCurrency(summary.creditSales)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-black font-bold text-[14px]">
                                <span>รวมยอดขาย:</span>
                                <span>{formatCurrency(summary.totalSales)}</span>
                            </div>
                        </div>

                        {/* Cash Drawer Reconciliation */}
                        <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 text-[12px]">
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
                            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-500">
                                <span>เงินสดนับได้จริง:</span>
                                <span>{formatCurrency(closingCash)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-[12.5px] pt-0.5">
                                <span>ส่วนต่าง (ขาด/เกิน):</span>
                                <span>
                                    {difference === 0 ? '0 (ตรงพอดี)' : difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                                </span>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="pt-4 text-center space-y-5 text-[11px]">
                            <div className="flex justify-between gap-3">
                                <div className="text-center w-1/2">
                                    <div className="border-b border-dotted border-black pb-6 mb-1"></div>
                                    <p>ลงชื่อผู้ส่งกะ</p>
                                    <p>({shift.userName})</p>
                                </div>
                                <div className="text-center w-1/2">
                                    <div className="border-b border-dotted border-black pb-6 mb-1"></div>
                                    <p>ลงชื่อผู้รับกะ/ผู้ตรวจ</p>
                                    <p>(....................)</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-600">พิมพ์เมื่อ: {formatDateTime(new Date())}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
