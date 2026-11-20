'use client';

import React from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { GrBillSummaryRow, PaginatedSlice } from '@/types/goods-receive-report';
import ReportPagination from './ReportPagination';

interface GoodsReceiveBillsViewProps {
    bills: PaginatedSlice<GrBillSummaryRow>;
    onPageChange: (nextPage: number) => void;
}

export default function GoodsReceiveBillsView({
    bills,
    onPageChange,
}: GoodsReceiveBillsViewProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                    🧾 รายการใบรับสินค้า GR ({bills.total.toLocaleString()} บิล)
                </h3>
            </div>

            {bills.rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    ไม่พบใบรับสินค้าตามตัวกรองที่เลือก
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                    <th className="text-left py-2.5 px-3 font-semibold">เลขที่ GR</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">เลข PO</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">วันที่รับ</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">บริษัทผู้ขาย</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">สินค้าในบิล</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ยอดก่อนลด</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ส่วนลด</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ยอดสุทธิ</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ค่ารถ</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ค่าลง</th>
                                    <th className="text-center py-2.5 px-2 font-semibold">ค่าสินค้า</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {bills.rows.map((bill) => (
                                    <tr key={bill.grId} className="hover:bg-gray-50">
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <Link
                                                href={`/goods-receive/${bill.grId}`}
                                                className="text-sm font-semibold text-emerald-600 hover:underline"
                                            >
                                                {bill.grNumber}
                                            </Link>
                                        </td>
                                        <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                                            {bill.poNumber ? (
                                                <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                    {bill.poNumber}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                                            {formatDate(bill.receivedDate)}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs font-medium text-gray-800">
                                            {bill.vendorName}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-gray-600 max-w-xs">
                                            <p className="truncate" title={bill.itemsPreview}>
                                                {bill.itemsPreview}
                                            </p>
                                            <p className="text-[11px] text-gray-400">
                                                {bill.itemCount} รายการ · รวม {bill.totalQuantity.toLocaleString()} หน่วย
                                            </p>
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-gray-500 whitespace-nowrap">
                                            {formatCurrency(bill.grossAmount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-amber-600 whitespace-nowrap">
                                            {bill.discountAmount > 0
                                                ? `-${formatCurrency(bill.discountAmount)}`
                                                : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-gray-800 whitespace-nowrap">
                                            {formatCurrency(bill.netAmount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-xs text-gray-600 whitespace-nowrap">
                                            {bill.shippingCost > 0 ? (
                                                <span title={bill.shippingPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}>
                                                    {bill.shippingPaid ? '✅ ' : '⬜ '}
                                                    {formatCurrency(bill.shippingCost)}
                                                </span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-xs text-gray-600 whitespace-nowrap">
                                            {bill.unloadingCost > 0 ? (
                                                <span title={bill.unloadingPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}>
                                                    {bill.unloadingPaid ? '✅ ' : '⬜ '}
                                                    {formatCurrency(bill.unloadingCost)}
                                                </span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                            {bill.goodsPaid ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                                                    ✅ จ่ายแล้ว
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                                                    ⏳ ค้างจ่าย
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ReportPagination
                        page={bills.page}
                        totalPages={bills.totalPages}
                        totalItems={bills.total}
                        onPageChange={onPageChange}
                        itemLabel="บิล"
                    />
                </>
            )}
        </div>
    );
}
