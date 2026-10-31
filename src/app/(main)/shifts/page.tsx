'use client';

import { useState, useEffect, useCallback } from 'react';
import { getShiftHistory, getShiftSummary } from '@/app/actions/shifts';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import ShiftPrintSlip from '@/components/shifts/ShiftPrintSlip';
import AlertModal from '@/components/AlertModal';

export default function ShiftsPage() {
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Print slip modal state
    const [printSlipData, setPrintSlipData] = useState<{
        open: boolean;
        shift: any;
        summary: any;
        closingCash: number;
        difference: number;
    }>({ open: false, shift: null, summary: null, closingCash: 0, difference: 0 });

    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    const loadShifts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getShiftHistory({
                page,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            });
            setShifts(res.shifts);
            setTotalPages(res.totalPages || 1);
            setTotalCount(res.total);
        } catch (err: any) {
            setAlertModal({ open: true, message: err.message || 'ไม่สามารถโหลดประวัติกะได้', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, dateFrom, dateTo]);

    useEffect(() => {
        loadShifts();
    }, [loadShifts]);

    const handleOpenPrintSlip = async (shiftId: string) => {
        try {
            const data = await getShiftSummary(shiftId);
            setPrintSlipData({
                open: true,
                shift: data.shift,
                summary: data.summary,
                closingCash: data.shift.closingCash != null ? data.shift.closingCash : data.summary.expectedCash,
                difference: data.shift.difference || 0,
            });
        } catch (err: any) {
            setAlertModal({ open: true, message: err.message || 'ไม่สามารถโหลดข้อมูลสลิปได้', type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="⏰ ประวัติกะการทำงาน"
                subtitle={`รายการกะทั้งหมด (${totalCount} รายการ)`}
            />

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <span>📅 ตั้งแต่วันที่:</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <span>ถึงวันที่:</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                {(dateFrom || dateTo) && (
                    <button
                        type="button"
                        onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                    >
                        ล้างตัวกรอง
                    </button>
                )}
            </div>

            {/* Shifts Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="py-20 flex justify-center">
                        <LoadingSpinner />
                    </div>
                ) : shifts.length === 0 ? (
                    <EmptyState
                        icon="⏰"
                        title="ยังไม่มีประวัติการเปิด-ปิดกะในระบบ"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">เลขที่กะ</th>
                                    <th className="px-4 py-3 font-semibold">พนักงาน</th>
                                    <th className="px-4 py-3 font-semibold">สถานะ</th>
                                    <th className="px-4 py-3 font-semibold">เวลาเปิดกะ</th>
                                    <th className="px-4 py-3 font-semibold">เวลาปิดกะ</th>
                                    <th className="px-4 py-3 font-semibold text-right">เงินทอน</th>
                                    <th className="px-4 py-3 font-semibold text-right">ยอดขายรวม</th>
                                    <th className="px-4 py-3 font-semibold text-right">เงินสด</th>
                                    <th className="px-4 py-3 font-semibold text-right">เงินโอน</th>
                                    <th className="px-4 py-3 font-semibold text-right">เช็ค</th>
                                    <th className="px-4 py-3 font-semibold text-right">ค้างชำระ</th>
                                    <th className="px-4 py-3 font-semibold text-right">ส่วนต่าง</th>
                                    <th className="px-5 py-3 text-center font-semibold">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {shifts.map(shift => (
                                    <tr key={shift.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-5 py-3.5 font-bold text-gray-800">{shift.shiftNumber}</td>
                                        <td className="px-4 py-3.5 font-medium text-gray-700">{shift.userName}</td>
                                        <td className="px-4 py-3.5">
                                            {shift.status === 'OPEN' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    กำลังเปิดกะ
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                                    ปิดกะแล้ว
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-gray-600">{formatDateTime(shift.openedAt)}</td>
                                        <td className="px-4 py-3.5 text-xs text-gray-600">{shift.closedAt ? formatDateTime(shift.closedAt) : '-'}</td>
                                        <td className="px-4 py-3.5 text-right font-medium text-gray-600">{formatCurrency(shift.startingCash)}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-gray-900">{formatCurrency(shift.totalSales)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs text-emerald-700 font-semibold">{formatCurrency(shift.cashSales)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs text-blue-700 font-semibold">{formatCurrency(shift.transferSales)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs text-purple-700 font-semibold">{formatCurrency(shift.chequeSales)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs text-amber-700 font-semibold">{formatCurrency(shift.creditSales)}</td>
                                        <td className="px-4 py-3.5 text-right text-xs">
                                            {shift.status === 'CLOSED' && shift.difference != null ? (
                                                <span className={`font-bold ${
                                                    shift.difference === 0
                                                        ? 'text-gray-500'
                                                        : shift.difference > 0
                                                            ? 'text-blue-600'
                                                            : 'text-red-600'
                                                }`}>
                                                    {shift.difference === 0 ? '0' : shift.difference > 0 ? `+${formatCurrency(shift.difference)}` : formatCurrency(shift.difference)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPrintSlip(shift.id)}
                                                className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 border border-gray-200 rounded-lg transition-colors inline-flex items-center gap-1"
                                                title="ดูสลิปสรุปยอด / พิมพ์"
                                            >
                                                🖨️ สลิป
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPageChange={(p: number) => setPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* Print Slip Modal */}
            {printSlipData.open && (
                <ShiftPrintSlip
                    open={printSlipData.open}
                    onClose={() => setPrintSlipData(prev => ({ ...prev, open: false }))}
                    shift={printSlipData.shift}
                    summary={printSlipData.summary}
                    closingCash={printSlipData.closingCash}
                    difference={printSlipData.difference}
                />
            )}

            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}
