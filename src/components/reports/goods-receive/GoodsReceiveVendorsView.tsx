'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getVendorGoodsReceiveBills } from '@/app/actions/reports';
import type {
    GoodsReceiveReportFilters,
    GrBillSummaryRow,
    GrVendorSummaryRow,
    PaginatedSlice,
} from '@/types/goods-receive-report';
import ReportPagination from './ReportPagination';

interface GoodsReceiveVendorsViewProps {
    vendors: PaginatedSlice<GrVendorSummaryRow>;
    activeFilters: Omit<GoodsReceiveReportFilters, 'vendorId' | 'view' | 'page' | 'exportAll'>;
    onPageChange: (nextPage: number) => void;
    onSelectVendorFilter: (vendorId: string) => void;
}

export default function GoodsReceiveVendorsView({
    vendors,
    activeFilters,
    onPageChange,
    onSelectVendorFilter,
}: GoodsReceiveVendorsViewProps) {
    const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
    const [vendorBillsMap, setVendorBillsMap] = useState<Record<string, GrBillSummaryRow[]>>({});
    const [loadingVendorId, setLoadingVendorId] = useState<string | null>(null);

    const toggleExpandVendor = async (vendorId: string) => {
        if (expandedVendorId === vendorId) {
            setExpandedVendorId(null);
            return;
        }
        setExpandedVendorId(vendorId);
        setLoadingVendorId(vendorId);
        try {
            const rows = await getVendorGoodsReceiveBills(vendorId, activeFilters);
            setVendorBillsMap((prev) => ({ ...prev, [vendorId]: rows }));
        } finally {
            setLoadingVendorId(null);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                        🏢 สรุปยอดรับสินค้าแยกตามบริษัทผู้ขาย ({vendors.total.toLocaleString()} บริษัท)
                    </h3>
                    <p className="text-xs text-gray-400">
                        คลิกที่แถวบริษัทเพื่อกางดูบิล GR ของบริษัทนั้น หรือกดปุ่ม &ldquo;ดูรายสินค้า&rdquo; เพื่อกรองดูสินค้าที่ซื้อจากบริษัทนั้น
                    </p>
                </div>
            </div>

            {vendors.rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    ไม่พบข้อมูลบริษัทผู้ขายตามตัวกรองที่เลือก
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                    <th className="text-left py-2.5 px-3 font-semibold">บริษัทผู้ขาย</th>
                                    <th className="text-center py-2.5 px-2 font-semibold">จำนวนบิล</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">จำนวนหน่วยรวม</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ยอดก่อนลด</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ส่วนลดรวม</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ยอดซื้อสุทธิ</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ค้างจ่าย</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ค่ารถ + ค่าลง</th>
                                    <th className="text-center py-2.5 px-2 font-semibold">ดูสินค้า</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {vendors.rows.map((v) => {
                                    const isExpanded = expandedVendorId === v.vendorId;
                                    const bills = vendorBillsMap[v.vendorId] || [];
                                    return (
                                        <React.Fragment key={v.vendorId}>
                                            <tr
                                                onClick={() => toggleExpandVendor(v.vendorId)}
                                                className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                                            >
                                                <td className="py-2.5 px-3 font-medium text-gray-800">
                                                    <span className="text-xs text-gray-400 mr-1.5">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                    {v.vendorName}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-xs text-gray-600">
                                                    {v.billCount} บิล
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-gray-700 whitespace-nowrap">
                                                    {v.totalQuantity.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-gray-500 whitespace-nowrap">
                                                    {formatCurrency(v.grossAmount)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-amber-600 whitespace-nowrap">
                                                    {v.discountAmount > 0
                                                        ? `-${formatCurrency(v.discountAmount)}`
                                                        : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                    {formatCurrency(v.netAmount)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    {v.unpaidNetAmount > 0 ? (
                                                        <span className="text-rose-600 font-semibold">
                                                            {formatCurrency(v.unpaidNetAmount)} ({v.unpaidBillCount})
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-emerald-600">ครบแล้ว</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-xs text-gray-600 whitespace-nowrap">
                                                    {formatCurrency(v.shippingTotal + v.unloadingTotal)}
                                                </td>
                                                <td
                                                    className="py-2.5 px-2 text-center whitespace-nowrap"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelectVendorFilter(v.vendorId)}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                    >
                                                        ดูรายสินค้า →
                                                    </button>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="bg-gray-50/80 px-4 py-3">
                                                        {loadingVendorId === v.vendorId ? (
                                                            <p className="text-xs text-gray-400 py-3 text-center">
                                                                กำลังโหลดรายการบิลของ {v.vendorName}...
                                                            </p>
                                                        ) : bills.length === 0 ? (
                                                            <p className="text-xs text-gray-400 py-2 text-center">
                                                                ไม่พบบิล
                                                            </p>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                    <thead>
                                                                        <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                                                                            <th className="py-2 px-3 text-left">เลข GR</th>
                                                                            <th className="py-2 px-3 text-left">วันที่รับ</th>
                                                                            <th className="py-2 px-3 text-left">รายการสินค้า</th>
                                                                            <th className="py-2 px-3 text-right">ส่วนลด</th>
                                                                            <th className="py-2 px-3 text-right">ยอดสุทธิ</th>
                                                                            <th className="py-2 px-3 text-center">สถานะจ่าย</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {bills.map((b) => (
                                                                            <tr key={b.grId} className="hover:bg-gray-50">
                                                                                <td className="py-2 px-3 whitespace-nowrap">
                                                                                    <Link
                                                                                        href={`/goods-receive/${b.grId}`}
                                                                                        className="font-semibold text-emerald-600 hover:underline"
                                                                                    >
                                                                                        {b.grNumber}
                                                                                    </Link>
                                                                                </td>
                                                                                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                                                                    {formatDate(b.receivedDate)}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-gray-700">
                                                                                    {b.itemsPreview}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right text-amber-600 whitespace-nowrap">
                                                                                    {b.discountAmount > 0
                                                                                        ? `-${formatCurrency(b.discountAmount)}`
                                                                                        : '-'}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                                                    {formatCurrency(b.netAmount)}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                                                                    {b.goodsPaid ? '✅ จ่ายแล้ว' : '⏳ ค้างจ่าย'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <ReportPagination
                        page={vendors.page}
                        totalPages={vendors.totalPages}
                        totalItems={vendors.total}
                        onPageChange={onPageChange}
                        itemLabel="บริษัท"
                    />
                </>
            )}
        </div>
    );
}
