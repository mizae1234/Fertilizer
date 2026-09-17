import { getDebtDetail } from '@/app/actions/debt';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import OverdueBillClient from './OverdueBillClient';

interface Props { params: Promise<{ id: string }> }

export default async function OverdueBillDetailPage({ params }: Props) {
    const { id } = await params;
    const sale = await getDebtDetail(id);
    if (!sale) notFound();

    // Serialize for client component
    const serialized = JSON.parse(JSON.stringify({
        id: sale.id,
        saleNumber: sale.saleNumber,
        status: sale.status,
        customerName: sale.customer?.name || 'ลูกค้าทั่วไป',
        customerPhone: sale.customer?.phone || '-',
        createdBy: sale.createdBy?.name || '-',
        createdAt: sale.createdAt,
        creditDueDate: sale.creditDueDate,
        currentDueDate: sale.currentDueDate,
        paymentMethod: sale.paymentMethod,
        notes: sale.notes,
        totalAmount: sale.totalAmount,
        totalInterest: sale.totalInterest,
        grandTotal: sale.grandTotal,
        initialPaid: sale.initialPaid,
        debtPaid: sale.debtPaid,
        totalPaid: sale.totalPaid,
        remaining: sale.remaining,
        isPaidOff: sale.isPaidOff,
        items: (sale.items as any[]).map(item => ({
            id: item.id,
            productName: item.product.name,
            productCode: item.product.code,
            unit: item.unitName || item.product.unit,
            warehouseName: item.warehouse.name,
            quantity: item.quantity,
            originalQuantity: item.originalQuantity ?? item.quantity,
            returnedQty: item.returnedQty || 0,
            isFullyReturned: item.isFullyReturned || false,
            isPartiallyReturned: item.isPartiallyReturned || false,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            originalTotalPrice: Number(item.originalTotalPrice ?? item.totalPrice),
        })),
        saleReturns: ((sale as any).saleReturns || []).map((sr: any) => ({
            id: sr.id,
            returnNumber: sr.returnNumber,
            reason: sr.reason,
            totalAmount: Number(sr.totalAmount),
            createdAt: sr.createdAt,
            createdByName: sr.createdBy?.name || '-',
            items: (sr.items || []).map((ri: any) => ({
                id: ri.id,
                productName: ri.product?.name || '-',
                productCode: ri.product?.code || '-',
                unit: ri.product?.unit || '',
                quantity: ri.quantity,
                unitPrice: Number(ri.unitPrice),
                totalPrice: Number(ri.totalPrice || ri.quantity * Number(ri.unitPrice)),
            })),
        })),
        debtPayments: sale.debtPayments.map(dp => ({
            id: dp.id,
            amount: Number(dp.amount),
            method: dp.method,
            dueDate: dp.dueDate,
            note: dp.note,
            paidAt: dp.paidAt,
        })),
        debtInterests: sale.debtInterests.map(di => ({
            id: di.id,
            percentage: Number(di.percentage),
            baseAmount: Number(di.baseAmount),
            amount: Number(di.amount),
            note: di.note,
            createdAt: di.createdAt,
        })),
    }));

    const isCancelled = sale.status === 'CANCELLED';

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Cancellation Banner */}
            {isCancelled && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-4 text-red-800">
                    <span className="text-3xl">🚫</span>
                    <div>
                        <p className="font-bold text-base">บิลนี้ถูกยกเลิกแล้ว (CANCELLED)</p>
                        <p className="text-xs text-red-600 mt-0.5">บิลนี้ถูกยกเลิกรายการเรียบร้อยแล้ว ไม่มียอดค้างชำระ และถูกตัดออกจากรายการค้างจ่าย</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/overdue-bills" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-800">📋 {sale.saleNumber}</h1>
                        {isCancelled && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">ยกเลิกแล้ว</span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">
                        {serialized.customerName} · วันที่ขาย {formatDate(sale.createdAt)}
                    </p>
                </div>
                {!isCancelled && sale.isPaidOff && (
                    <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">✅ ชำระครบแล้ว</span>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">มูลค่าบิล</p>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(sale.totalAmount)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">ดอกเบี้ยรวม</p>
                    <p className="text-lg font-bold text-orange-500">{formatCurrency(sale.totalInterest)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">จ่ายแล้ว</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(sale.totalPaid)}</p>
                </div>
                <div className={`rounded-xl border p-4 shadow-sm ${sale.remaining > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">ค้างชำระ</p>
                    <p className={`text-lg font-bold ${sale.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(sale.remaining)}</p>
                </div>
            </div>

            {/* Due Date Info */}
            {!isCancelled && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-400">กำหนดชำระ</p>
                            <p className="text-sm font-semibold text-gray-800">
                                {sale.currentDueDate ? formatDate(sale.currentDueDate) : '-'}
                            </p>
                        </div>
                        {sale.currentDueDate && (() => {
                            const diff = Math.floor((new Date().getTime() - new Date(sale.currentDueDate).getTime()) / 86400000);
                            if (diff > 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">🔴 เกินกำหนด {diff} วัน</span>;
                            return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">🟢 ยังไม่ถึงกำหนด</span>;
                        })()}
                    </div>
                </div>
            )}

            {/* Product Items Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-700">📦 รายการสินค้า</h2>
                    <span className="text-xs text-gray-400">ยอดคงเหลือจริงหลังหักการคืน</span>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <th className="px-4 py-2 text-left">สินค้า</th>
                            <th className="px-4 py-2 text-right">จำนวน</th>
                            <th className="px-4 py-2 text-right">ราคา/หน่วย</th>
                            <th className="px-4 py-2 text-right">รวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {(serialized.items as any[]).map(item => {
                            const isFully = item.isFullyReturned;
                            return (
                                <tr key={item.id} className={`hover:bg-gray-50 ${isFully ? 'opacity-60 bg-gray-50/60' : ''}`}>
                                    <td className="px-4 py-2.5">
                                        <p className={`text-sm font-medium ${isFully ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.productName}</p>
                                        <p className="text-[11px] text-gray-400">{item.productCode}</p>
                                        {item.returnedQty > 0 && (
                                            <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 font-medium">
                                                {isFully ? `คืนแล้วทั้งหมด (${item.returnedQty} ${item.unit})` : `คืนแล้ว ${item.returnedQty} ${item.unit}`}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-right text-gray-600">
                                        <span className={isFully ? 'line-through text-gray-400' : 'font-semibold text-gray-800'}>
                                            {item.quantity}
                                        </span>
                                        {item.returnedQty > 0 && (
                                            <span className="text-[11px] text-gray-400 block">
                                                (เดิม {item.originalQuantity})
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400"> {item.unit}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-right text-gray-600">{formatCurrency(Number(item.unitPrice))}</td>
                                    <td className="px-4 py-2.5 text-sm text-right font-medium">
                                        {isFully ? (
                                            <span className="text-gray-400 line-through">{formatCurrency(Number(item.originalTotalPrice))}</span>
                                        ) : (
                                            <span className="text-gray-800">{formatCurrency(Number(item.totalPrice))}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Sale Returns History */}
            {serialized.saleReturns && serialized.saleReturns.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-orange-600">📦 ประวัติคืนสินค้า ({serialized.saleReturns.length} ครั้ง)</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {serialized.saleReturns.map((sr: any) => (
                            <div key={sr.id} className="p-4 bg-orange-50/20">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-orange-600">{sr.returnNumber}</span>
                                        <span className="text-xs text-gray-400">{formatDate(sr.createdAt)}</span>
                                    </div>
                                    <span className="text-sm font-bold text-orange-600">-{formatCurrency(Number(sr.totalAmount))}</span>
                                </div>
                                {sr.reason && <p className="text-xs text-gray-600 mb-1.5">เหตุผล: {sr.reason}</p>}
                                <div className="space-y-1">
                                    {sr.items.map((ri: any) => (
                                        <div key={ri.id} className="flex justify-between text-xs text-gray-600 pl-2 border-l-2 border-orange-200">
                                            <span>{ri.productName} ({ri.productCode})</span>
                                            <span>คืน {ri.quantity} {ri.unit} × {formatCurrency(Number(ri.unitPrice))}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1.5">ผู้ทำรายการ: {sr.createdByName}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Client-side interactive sections */}
            <OverdueBillClient sale={serialized} />
        </div>
    );
}
