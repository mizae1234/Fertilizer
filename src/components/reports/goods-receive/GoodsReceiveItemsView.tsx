'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
    GrProductRollupRow,
    GrReportItemRow,
    PaginatedSlice,
} from '@/types/goods-receive-report';
import ReportPagination from './ReportPagination';

interface GoodsReceiveItemsViewProps {
    items: PaginatedSlice<GrReportItemRow>;
    productRollup: PaginatedSlice<GrProductRollupRow>;
    onPageChange: (nextPage: number) => void;
    onProductRollupPageChange: (nextPage: number) => void;
    onQuickFilterProduct: (productCode: string) => void;
}

export default function GoodsReceiveItemsView({
    items,
    productRollup,
    onPageChange,
    onProductRollupPageChange,
    onQuickFilterProduct,
}: GoodsReceiveItemsViewProps) {
    const [showRollup, setShowRollup] = useState(true);

    return (
        <div className="space-y-4">
            {/* 1. Aggregated Summary per Product SKU */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">
                            📊 สรุปรวมตามตัวสินค้า ({productRollup.total.toLocaleString()} รายการสินค้า)
                        </h3>
                        <p className="text-xs text-gray-400">
                            คลิกที่รหัสสินค้าเพื่อกรองดูเฉพาะสินค้านั้นอย่างรวดเร็ว
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowRollup((prev) => !prev)}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                        {showRollup ? 'ซ่อนตารางสรุปรายสินค้า ▲' : 'แสดงตารางสรุปรายสินค้า ▼'}
                    </button>
                </div>

                {showRollup && (
                    <>
                        {productRollup.rows.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">
                                ไม่พบข้อมูลสินค้าที่รับเข้าตามเงื่อนไขที่เลือก
                            </p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                <th className="text-left py-2.5 px-3 font-semibold">รหัส</th>
                                                <th className="text-left py-2.5 px-3 font-semibold">ชื่อสินค้า</th>
                                                <th className="text-left py-2.5 px-3 font-semibold">เลข PO</th>
                                                <th className="text-center py-2.5 px-2 font-semibold">จำนวนครั้ง</th>
                                                <th className="text-right py-2.5 px-3 font-semibold">รับเข้ารวม</th>
                                                <th className="text-right py-2.5 px-3 font-semibold">ทุนเฉลี่ยก่อนลด</th>
                                                <th className="text-right py-2.5 px-3 font-semibold">ทุนสุทธิเฉลี่ย/หน่วย</th>
                                                <th className="text-right py-2.5 px-3 font-semibold">ส่วนลดเฉลี่ยรวม</th>
                                                <th className="text-right py-2.5 px-3 font-semibold">มูลค่าซื้อสุทธิรวม</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {productRollup.rows.map((prod) => (
                                                <tr key={prod.productId} className="hover:bg-emerald-50/30">
                                                    <td className="py-2 px-3 whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => onQuickFilterProduct(prod.productCode)}
                                                            className="font-mono text-xs text-emerald-600 hover:underline font-medium"
                                                            title="คลิกเพื่อกรองเฉพาะสินค้านี้"
                                                        >
                                                            {prod.productCode}
                                                        </button>
                                                    </td>
                                                    <td className="py-2 px-3 font-medium text-gray-800">
                                                        {prod.productName}
                                                        <span className="text-xs text-gray-400 ml-1.5">
                                                            ({prod.vendorCount} บริษัท)
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-xs text-gray-600 max-w-[180px]">
                                                        {prod.poNumbers.length > 0 ? (
                                                            <span
                                                                className="block truncate font-medium text-indigo-600"
                                                                title={prod.poNumbers.join(', ')}
                                                            >
                                                                {prod.poNumbers.join(', ')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-center text-xs text-gray-600">
                                                        {prod.receiveCount} ครั้ง
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                        {prod.totalQuantity.toLocaleString()} {prod.unit}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-500 whitespace-nowrap">
                                                        {formatCurrency(prod.avgGrossUnitCost)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-medium text-emerald-700 whitespace-nowrap">
                                                        {formatCurrency(prod.avgNetUnitCost)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-amber-600 whitespace-nowrap">
                                                        {prod.discountShare > 0
                                                            ? `-${formatCurrency(prod.discountShare)}`
                                                            : '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-gray-800 whitespace-nowrap">
                                                        {formatCurrency(prod.netTotal)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <ReportPagination
                                    page={productRollup.page}
                                    totalPages={productRollup.totalPages}
                                    totalItems={productRollup.total}
                                    onPageChange={onProductRollupPageChange}
                                    itemLabel="สินค้า"
                                />
                            </>
                        )}
                    </>
                )}
            </div>

            {/* 2. Chronological Item-Level Receive Log */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                        📋 รายละเอียดการรับสินค้าเข้าแต่ละรายการ ({items.total.toLocaleString()} รายการ)
                    </h3>
                </div>

                {items.rows.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                        ไม่พบรายการรับสินค้าเข้าตามตัวกรองที่เลือก
                    </p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                        <th className="text-left py-2.5 px-3 font-semibold">วันที่</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">เลขที่ GR</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">เลข PO</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">บริษัทผู้ขาย</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">สินค้า</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">คลัง</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">จำนวน</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">ทุน/หน่วย</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">ทุนสุทธิ/หน่วย</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">รวมสุทธิ</th>
                                        <th className="text-center py-2.5 px-2 font-semibold">ค่าสินค้า</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.rows.map((row) => {
                                        const hasDiscount = row.discountShare > 0;
                                        return (
                                            <tr key={row.itemId} className="hover:bg-gray-50">
                                                <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                                                    {formatDate(row.date)}
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <Link
                                                        href={`/goods-receive/${row.grId}`}
                                                        className="text-xs font-semibold text-emerald-600 hover:underline"
                                                    >
                                                        {row.grNumber}
                                                    </Link>
                                                </td>
                                                <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                                                    {row.poNumber ? (
                                                        <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                            {row.poNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-700 text-xs font-medium">
                                                    {row.vendorName}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <p className="text-sm font-medium text-gray-800">{row.productName}</p>
                                                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                                        <span className="font-mono">{row.productCode}</span>
                                                        {row.lotNo && (
                                                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded">
                                                                Lot: {row.lotNo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-600 whitespace-nowrap">
                                                    {row.warehouseName}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                    {row.quantity.toLocaleString()} {row.unit}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-gray-500 whitespace-nowrap">
                                                    {formatCurrency(row.grossUnitCost)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <span className="font-medium text-emerald-700">
                                                        {formatCurrency(row.netUnitCost)}
                                                    </span>
                                                    {hasDiscount && (
                                                        <p className="text-[10px] text-amber-600">
                                                            ลด -{formatCurrency(row.discountShare)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-gray-800 whitespace-nowrap">
                                                    {formatCurrency(row.netTotal)}
                                                </td>
                                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                    {row.goodsPaid ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                                                            จ่ายแล้ว
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                                                            ค้างจ่าย
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ReportPagination
                            page={items.page}
                            totalPages={items.totalPages}
                            totalItems={items.total}
                            onPageChange={onPageChange}
                            itemLabel="รายการ"
                        />
                    </>
                )}
            </div>
        </div>
    );
}
