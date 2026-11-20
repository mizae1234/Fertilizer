'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { approveTransfer, rejectTransfer, cancelTransfer } from '@/app/actions/transfers';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatDate, formatDateTime, roundQty } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

interface TransferDetail {
    id: string;
    transferNumber: string;
    status: string;
    notes: string | null;
    createdAt: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    fromWarehouse: { id: string; name: string };
    toWarehouse: { id: string; name: string };
    createdBy: { name: string };
    cancelledBy: { name: string } | null;
    items: {
        id: string;
        quantity: number;
        product: {
            id: string;
            name: string;
            code: string;
            unit: string;
            productStocks?: { warehouseId: string; quantity: number }[];
        };
        warehouse: { name: string };
    }[];
}

export default function TransferDetailPage() {
    const params = useParams();
    const router = useRouter();
    const user = useUser();
    const [transfer, setTransfer] = useState<TransferDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [alertModal, setAlertModal] = useState<{
        open: boolean;
        message: string;
        type: 'error' | 'success' | 'warning';
        title?: string;
    }>({ open: false, message: '', type: 'error' });

    const loadTransfer = useCallback(async () => {
        try {
            const res = await fetch(`/api/transfers/${params.id}`, { cache: 'no-store' });
            if (!res.ok) {
                setTransfer(null);
                return;
            }
            const data = await res.json();
            setTransfer(data);
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        loadTransfer();
    }, [loadTransfer]);

    // Aggregate items by product so Before/After warehouse preview is accurate even if duplicate lines exist
    const reversalPreview = useMemo(() => {
        if (!transfer) return [];
        const map = new Map<string, {
            productId: string;
            name: string;
            code: string;
            unit: string;
            totalQty: number;
            destBefore: number;
            destAfter: number;
            sourceBefore: number;
            sourceAfter: number;
        }>();

        for (const item of transfer.items) {
            const pid = item.product.id;
            const qty = roundQty(item.quantity);
            const existing = map.get(pid);
            if (existing) {
                existing.totalQty = roundQty(existing.totalQty + qty);
                existing.destAfter = roundQty(existing.destBefore - existing.totalQty);
                existing.sourceAfter = roundQty(existing.sourceBefore + existing.totalQty);
            } else {
                const stocks = item.product.productStocks || [];
                const destBefore = roundQty(
                    stocks.find(s => s.warehouseId === transfer.toWarehouse.id)?.quantity ?? 0
                );
                const sourceBefore = roundQty(
                    stocks.find(s => s.warehouseId === transfer.fromWarehouse.id)?.quantity ?? 0
                );
                map.set(pid, {
                    productId: pid,
                    name: item.product.name,
                    code: item.product.code,
                    unit: item.product.unit,
                    totalQty: qty,
                    destBefore,
                    destAfter: roundQty(destBefore - qty),
                    sourceBefore,
                    sourceAfter: roundQty(sourceBefore + qty),
                });
            }
        }

        return Array.from(map.values());
    }, [transfer]);

    const hasNegativeDestProjection = useMemo(
        () => reversalPreview.some(row => row.destAfter < 0),
        [reversalPreview]
    );

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await approveTransfer(params.id as string);
            await loadTransfer();
            router.refresh();
        } catch (error) {
            setAlertModal({
                open: true,
                message: (error as Error).message,
                type: 'error',
                title: 'เกิดข้อผิดพลาด',
            });
        } finally {
            setActionLoading(false);
            setShowApprove(false);
        }
    };

    const handleReject = async () => {
        setActionLoading(true);
        try {
            await rejectTransfer(params.id as string);
            await loadTransfer();
            router.refresh();
        } catch (error) {
            setAlertModal({
                open: true,
                message: (error as Error).message,
                type: 'error',
                title: 'เกิดข้อผิดพลาด',
            });
        } finally {
            setActionLoading(false);
            setShowReject(false);
        }
    };

    const handleCancelTransfer = async () => {
        const trimmed = cancelReason.trim();
        if (!trimmed) {
            setAlertModal({
                open: true,
                message: 'กรุณาระบุเหตุผลการยกเลิกใบโอนสินค้า',
                type: 'warning',
                title: 'ข้อมูลไม่ครบ',
            });
            return;
        }

        setActionLoading(true);
        try {
            await cancelTransfer(params.id as string, trimmed);
            setShowCancelModal(false);
            setCancelReason('');
            await loadTransfer();
            router.refresh();
            setAlertModal({
                open: true,
                message: `ยกเลิกใบโอน ${transfer?.transferNumber || ''} และคืนสต็อกกลับคลัง ${transfer?.fromWarehouse.name || ''} เรียบร้อยแล้ว`,
                type: 'success',
                title: 'ยกเลิกใบโอนสำเร็จ',
            });
        } catch (error) {
            setAlertModal({
                open: true,
                message: (error as Error).message,
                type: 'error',
                title: 'เกิดข้อผิดพลาด',
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">กำลังโหลด...</div></div>;
    if (!transfer) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>;

    const isAdmin = user?.role === 'ADMIN';
    const isCancelled = transfer.status === 'CANCELLED';

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <button
                type="button"
                onClick={() => router.push('/transfers')}
                className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1"
            >
                ← กลับรายการโอนสินค้า
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {transfer.transferNumber}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">เอกสารโอนสินค้าระหว่างคลัง</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <StatusBadge status={transfer.status} className="text-sm px-3 py-1.5" />
                    {transfer.status === 'APPROVED' && isAdmin && (
                        <button
                            type="button"
                            onClick={() => {
                                setCancelReason('');
                                setShowCancelModal(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-medium text-sm transition-colors"
                        >
                            ❌ ยกเลิกใบโอนสินค้า
                        </button>
                    )}
                </div>
            </div>

            {/* Cancellation Audit Log Banner */}
            {isCancelled && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-6">
                    <div className="flex items-start gap-3">
                        <span className="text-xl leading-none mt-0.5">❌</span>
                        <div className="flex-1 space-y-2">
                            <h2 className="text-sm font-bold text-rose-800">
                                เอกสารโอนสินค้านี้ถูกยกเลิกและคืนสต็อกกลับคลังต้นทางแล้ว (Log การยกเลิก)
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-rose-700 bg-white/70 rounded-lg p-3 border border-rose-100">
                                <div>
                                    <span className="text-rose-500">ผู้ยกเลิก (ADMIN):</span>{' '}
                                    <strong className="text-rose-900">{transfer.cancelledBy?.name || '-'}</strong>
                                </div>
                                <div>
                                    <span className="text-rose-500">วัน-เวลาที่ยกเลิก:</span>{' '}
                                    <strong className="text-rose-900">
                                        {transfer.cancelledAt ? formatDateTime(transfer.cancelledAt) : '-'}
                                    </strong>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-rose-500">การคืนสต็อก:</span>{' '}
                                    <span>
                                        หักสินค้าออกจากคลัง <strong>{transfer.toWarehouse.name}</strong> และคืนกลับเข้าคลัง{' '}
                                        <strong>{transfer.fromWarehouse.name}</strong> เรียบร้อยแล้ว
                                    </span>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-rose-500">เหตุผลการยกเลิก:</span>{' '}
                                    <strong className="text-rose-900">{transfer.cancelReason || '-'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">จากคลัง (ต้นทาง)</p>
                        <p className="text-sm font-medium text-gray-800">{transfer.fromWarehouse.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">ไปคลัง (ปลายทาง)</p>
                        <p className="text-sm font-medium text-gray-800">{transfer.toWarehouse.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">สร้างโดย</p>
                        <p className="text-sm text-gray-800">{transfer.createdBy.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">วันที่สร้าง</p>
                        <p className="text-sm text-gray-800">{formatDate(transfer.createdAt)}</p>
                    </div>
                </div>
                {transfer.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500">หมายเหตุ</p>
                        <p className="text-sm text-gray-800">{transfer.notes}</p>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">รายการสินค้า ({transfer.items.length} รายการ)</h2>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวน</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {transfer.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                <td className="px-4 py-3">
                                    <p className={`text-sm font-medium ${isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                        {item.product.name}
                                    </p>
                                    <p className="text-xs text-gray-400">{item.product.code}</p>
                                </td>
                                <td className={`px-4 py-3 text-sm text-right ${isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {item.quantity.toLocaleString()} {item.product.unit}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {transfer.status === 'PENDING' && isAdmin && (
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setShowReject(true)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium text-sm hover:from-red-600 hover:to-rose-600"
                    >
                        ปฏิเสธ
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowApprove(true)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200"
                    >
                        อนุมัติ
                    </button>
                </div>
            )}

            {/* Cancel Approved Transfer Modal (ADMIN Only) */}
            {showCancelModal && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">
                                    ยืนยันการยกเลิกใบโอน {transfer.transferNumber}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    ระบบจะหักสินค้าออกจากคลังปลายทาง <strong>{transfer.toWarehouse.name}</strong> และคืนสต็อกกลับเข้าคลังต้นทาง{' '}
                                    <strong>{transfer.fromWarehouse.name}</strong> พร้อมบันทึกประวัติลง Stock Card
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !actionLoading && setShowCancelModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Stock Reversal Preview Table */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                            <th className="px-3 py-2.5 text-left font-semibold">สินค้า</th>
                                            <th className="px-3 py-2.5 text-right font-semibold">จำนวนที่คืน</th>
                                            <th className="px-3 py-2.5 text-right font-semibold">
                                                คลังปลายทาง ({transfer.toWarehouse.name})
                                            </th>
                                            <th className="px-3 py-2.5 text-right font-semibold">
                                                คลังต้นทาง ({transfer.fromWarehouse.name})
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reversalPreview.map(row => {
                                            const destWillBeNegative = row.destAfter < 0;
                                            return (
                                                <tr key={row.productId} className={destWillBeNegative ? 'bg-amber-50/50' : ''}>
                                                    <td className="px-3 py-2.5">
                                                        <p className="font-medium text-gray-800">{row.name}</p>
                                                        <p className="text-[11px] text-gray-400">{row.code}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                        {row.totalQty.toLocaleString()} {row.unit}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                        <span className="text-gray-500">{row.destBefore.toLocaleString()}</span>
                                                        <span className="mx-1 text-gray-400">→</span>
                                                        <strong className={destWillBeNegative ? 'text-rose-600' : 'text-gray-800'}>
                                                            {row.destAfter.toLocaleString()}
                                                        </strong>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                        <span className="text-gray-500">{row.sourceBefore.toLocaleString()}</span>
                                                        <span className="mx-1 text-gray-400">→</span>
                                                        <strong className="text-emerald-600">
                                                            {row.sourceAfter.toLocaleString()}
                                                        </strong>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {hasNegativeDestProjection && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                                ⚠️ <strong>แจ้งเตือน:</strong> มีสินค้าบางรายการในคลังปลายทาง ({transfer.toWarehouse.name})
                                ที่คงเหลือน้อยกว่าจำนวนที่โอนมา (อาจถูกขายหรือจ่ายออกไปแล้ว) หากยืนยันยกเลิก
                                สต็อกในคลังปลายทางจะติดลบตามจำนวนจริง และระบบจะคืนสต็อกเข้าคลังต้นทาง ({transfer.fromWarehouse.name}) เต็มจำนวนตามใบโอน
                            </div>
                        )}

                        <div className="mb-5">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                เหตุผลการยกเลิกใบโอนสินค้า <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="เช่น คีย์คลังปลายทางผิด, คีย์จำนวนสินค้าผิด, ยกเลิกการโอนย้าย..."
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none text-sm resize-none"
                                disabled={actionLoading}
                            />
                        </div>

                        <div className="flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowCancelModal(false)}
                                disabled={actionLoading}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                ปิด
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelTransfer}
                                disabled={actionLoading || !cancelReason.trim()}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-medium text-sm hover:from-rose-600 hover:to-red-700 shadow-md shadow-rose-200 disabled:opacity-50"
                            >
                                {actionLoading ? 'กำลังยกเลิกและคืนสต็อก...' : 'ยืนยันยกเลิกและคืนสต็อก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showApprove}
                onClose={() => setShowApprove(false)}
                onConfirm={handleApprove}
                title="ยืนยันการอนุมัติ"
                message={`ยืนยันอนุมัติ ${transfer.transferNumber}? สินค้าจะถูกโอนจาก ${transfer.fromWarehouse.name} ไปยัง ${transfer.toWarehouse.name}`}
                confirmText="อนุมัติ"
                variant="success"
                loading={actionLoading}
            />
            <ConfirmModal
                isOpen={showReject}
                onClose={() => setShowReject(false)}
                onConfirm={handleReject}
                title="ยืนยันการปฏิเสธ"
                message={`ยืนยันปฏิเสธ ${transfer.transferNumber}?`}
                confirmText="ปฏิเสธ"
                variant="danger"
                loading={actionLoading}
            />
            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title || 'แจ้งเตือน'}
            />
        </div>
    );
}
