import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import { notFound } from 'next/navigation';
import CancelWithdrawalButton from './CancelWithdrawalButton';
import PrintWithdrawalButton from './PrintWithdrawalButton';
import { isServerAdmin } from '@/lib/server-auth';
import StatusBadge from '@/components/StatusBadge';

interface Props { params: Promise<{ id: string }> }

export default async function StockWithdrawalDetailPage({ params }: Props) {
    const { id } = await params;
    const adminUser = await isServerAdmin();
    const wd = await prisma.stockWithdrawal.findUnique({
        where: { id },
        include: {
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!wd) notFound();

    const isCancelled = wd.status === 'CANCELLED';

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{wd.withdrawalNumber}</h1>
                            <StatusBadge status={wd.status} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">ใบเบิกสินค้า</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isCancelled && adminUser && <CancelWithdrawalButton id={id} withdrawalNumber={wd.withdrawalNumber} />}
                    <PrintWithdrawalButton id={id} />
                    <Link href="/stock-withdrawals" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        ← กลับ
                    </Link>
                </div>
            </div>

            {isCancelled && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <p className="text-sm font-semibold text-red-700">รายการนี้ถูกยกเลิกแล้ว</p>
                        <p className="text-xs text-red-500">Stock ถูกคืนกลับเรียบร้อยแล้ว</p>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className={`bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-4 ${isCancelled ? 'opacity-60' : ''}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">ผู้เบิกสินค้า</p>
                        <p className="text-sm font-semibold text-gray-800">{wd.requesterName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">สร้างโดย</p>
                        <p className="text-sm text-gray-800">{wd.createdBy.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">วันที่</p>
                        <p className="text-sm text-gray-800">{formatDateTime(wd.createdAt)}</p>
                    </div>
                </div>
                {wd.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">หมายเหตุ</p>
                        <p className="text-sm text-gray-700">{wd.notes}</p>
                    </div>
                )}
            </div>

            {/* Items */}
            <div className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-4 ${isCancelled ? 'opacity-60' : ''}`}>
                <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-800">รายการสินค้า ({wd.items.length} รายการ)</h2>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">สินค้า</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">คลัง</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">จำนวน</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {wd.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                                    <p className="text-xs text-gray-400">{item.product.code}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.warehouse.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-800 text-right">{item.quantity} {item.product.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Signatures */}
            {(wd.approverName || wd.withdrawerName) && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                    <h2 className="text-base font-bold text-gray-800 mb-4">✍️ ลงชื่อ</h2>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="text-center">
                            <div className="h-16 flex items-end justify-center">
                                <p className="text-sm font-medium text-gray-800">{wd.approverName || '___________________'}</p>
                            </div>
                            <div className="border-t border-gray-300 pt-2 mt-2">
                                <p className="text-xs text-gray-500">ผู้อนุมัติการเบิก</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="h-16 flex items-end justify-center">
                                <p className="text-sm font-medium text-gray-800">{wd.withdrawerName || '___________________'}</p>
                            </div>
                            <div className="border-t border-gray-300 pt-2 mt-2">
                                <p className="text-xs text-gray-500">ผู้ขอเบิกสินค้า</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
