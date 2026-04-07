import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import { notFound } from 'next/navigation';
import PrintFactoryReturnButton from './PrintFactoryReturnButton';
import CancelFactoryReturnButton from './CancelFactoryReturnButton';
import { isServerAdmin } from '@/lib/server-auth';

interface Props { params: Promise<{ id: string }> }

export default async function FactoryReturnDetailPage({ params }: Props) {
    const { id } = await params;
    const adminUser = await isServerAdmin();
    const fr = await prisma.factoryReturn.findUnique({
        where: { id },
        include: {
            vendor: { select: { name: true } },
            createdBy: { select: { name: true } },
            items: {
                include: {
                    product: { select: { name: true, code: true, unit: true } },
                    warehouse: { select: { name: true } },
                },
            },
        },
    });

    if (!fr) notFound();

    const isCancelled = fr.status === 'CANCELLED';

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{fr.returnNumber}</h1>
                            {isCancelled ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">❌ ยกเลิกแล้ว</span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✅ สำเร็จ</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">ใบเคลมคืนโรงงาน</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isCancelled && adminUser && <CancelFactoryReturnButton id={id} returnNumber={fr.returnNumber} />}
                    <PrintFactoryReturnButton id={id} />
                    <Link href="/factory-returns" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
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
                        <p className="text-xs text-gray-500">ผู้ขาย/โรงงาน/บริษัท</p>
                        <p className="text-sm font-semibold text-gray-800">{fr.vendor.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">สร้างโดย</p>
                        <p className="text-sm text-gray-800">{fr.createdBy.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">วันที่</p>
                        <p className="text-sm text-gray-800">{formatDateTime(fr.createdAt)}</p>
                    </div>
                </div>
                {fr.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">หมายเหตุ</p>
                        <p className="text-sm text-gray-700">{fr.notes}</p>
                    </div>
                )}
            </div>

            {/* Items */}
            <div className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-4 ${isCancelled ? 'opacity-60' : ''}`}>
                <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-800">รายการสินค้า ({fr.items.length} รายการ)</h2>
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
                        {fr.items.map((item, idx) => (
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
            {(fr.senderName || fr.receiverName) && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                    <h2 className="text-base font-bold text-gray-800 mb-4">✍️ ลงชื่อ</h2>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="text-center">
                            <div className="h-16 flex items-end justify-center">
                                <p className="text-sm font-medium text-gray-800">{fr.senderName || '___________________'}</p>
                            </div>
                            <div className="border-t border-gray-300 pt-2 mt-2">
                                <p className="text-xs text-gray-500">ผู้ส่งสินค้าคืน</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="h-16 flex items-end justify-center">
                                <p className="text-sm font-medium text-gray-800">{fr.receiverName || '___________________'}</p>
                            </div>
                            <div className="border-t border-gray-300 pt-2 mt-2">
                                <p className="text-xs text-gray-500">ผู้ตรวจนับและรับสินค้าคืน</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
