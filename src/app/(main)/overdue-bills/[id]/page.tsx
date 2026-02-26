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
        items: sale.items.map(item => ({
            id: item.id,
            productName: item.product.name,
            productCode: item.product.code,
            unit: item.product.unit,
            warehouseName: item.warehouse.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
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

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/overdue-bills" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-800">📋 {sale.saleNumber}</h1>
                    <p className="text-sm text-gray-500">
                        {serialized.customerName} · วันที่ขาย {formatDate(sale.createdAt)}
                    </p>
                </div>
                {sale.isPaidOff && (
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

            {/* Product Items Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">📦 รายการสินค้า</h2>
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
                        {sale.items.map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-2.5">
                                    <p className="text-sm text-gray-800">{item.product.name}</p>
                                    <p className="text-[11px] text-gray-400">{item.product.code}</p>
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right text-gray-600">{item.quantity} {item.product.unit}</td>
                                <td className="px-4 py-2.5 text-sm text-right text-gray-600">{formatCurrency(Number(item.unitPrice))}</td>
                                <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-800">{formatCurrency(Number(item.totalPrice))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Client-side interactive sections */}
            <OverdueBillClient sale={serialized} />
        </div>
    );
}
