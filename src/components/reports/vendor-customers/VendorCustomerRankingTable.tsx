'use client';

import React, { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCustomerVendorProductBreakdown } from '@/app/actions/reports';
import type { PaginatedSlice } from '@/types/goods-receive-report';
import type {
    CustomerVendorProductBreakdownRow,
    VendorCustomerRankRow,
    VendorCustomerReportFilters,
    VendorProductSalesRow,
    VendorPromoSubView,
} from '@/types/vendor-customer-report';
import ReportPagination from '@/components/reports/goods-receive/ReportPagination';

interface VendorCustomerRankingTableProps {
    subView: VendorPromoSubView;
    customers?: PaginatedSlice<VendorCustomerRankRow>;
    products?: PaginatedSlice<VendorProductSalesRow>;
    drilldownFilters: Omit<VendorCustomerReportFilters, 'page' | 'pageSize' | 'exportAll' | 'subView'>;
    onPageChange: (nextPage: number) => void;
}

function renderRankBadge(rank: number) {
    if (rank === 1) return <span className="font-bold text-amber-500">🥇 1</span>;
    if (rank === 2) return <span className="font-bold text-slate-500">🥈 2</span>;
    if (rank === 3) return <span className="font-bold text-amber-700">🥉 3</span>;
    return <span className="text-gray-500 font-medium">{rank}</span>;
}

export default function VendorCustomerRankingTable({
    subView,
    customers,
    products,
    drilldownFilters,
    onPageChange,
}: VendorCustomerRankingTableProps) {
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [breakdownMap, setBreakdownMap] = useState<
        Record<string, CustomerVendorProductBreakdownRow[]>
    >({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);

    const toggleCustomerRow = async (customerKey: string) => {
        if (expandedKey === customerKey) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(customerKey);
        setLoadingKey(customerKey);
        try {
            const rows = await getCustomerVendorProductBreakdown(customerKey, drilldownFilters);
            setBreakdownMap((prev) => ({ ...prev, [customerKey]: rows }));
        } finally {
            setLoadingKey(null);
        }
    };

    if (subView === 'products' && products) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                        📦 สรุปสินค้าของผู้ขายนี้ที่ขายออก ({products.total.toLocaleString()} รายการสินค้า)
                    </h3>
                    <p className="text-xs text-gray-400">
                        หากสินค้าตัวใดเคยซื้อเข้าจากผู้ขายมากกว่า 1 เจ้า ระบบจะแสดงป้ายรายชื่อผู้ขายทั้งหมดให้ทราบทันที
                    </p>
                </div>

                {products.rows.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                        ไม่พบรายการขายสินค้าของผู้ขายนี้ในช่วงเวลาและเงื่อนไขที่เลือก
                    </p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                        <th className="text-left py-2.5 px-3 font-semibold">รหัส</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">ชื่อสินค้า</th>
                                        <th className="text-left py-2.5 px-3 font-semibold">ผู้ขายที่เคยส่งสินค้านี้</th>
                                        <th className="text-center py-2.5 px-2 font-semibold">ผู้ซื้อ</th>
                                        <th className="text-center py-2.5 px-2 font-semibold">จำนวนบิล</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">ขายสุทธิรวม</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">ยอดขายสุทธิ</th>
                                        <th className="text-right py-2.5 px-3 font-semibold">กำไรขั้นต้น</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {products.rows.map((p) => {
                                        const isMultiVendor = p.sourcedVendors.length > 1;
                                        return (
                                            <tr key={p.productId} className="hover:bg-gray-50">
                                                <td className="py-2.5 px-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                                                    {p.productCode}
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-800">
                                                    {p.productName}
                                                    {p.brand && (
                                                        <span className="text-xs text-gray-400 ml-1.5">
                                                            ({p.brand})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs max-w-[220px]">
                                                    {p.sourcedVendors.length > 0 ? (
                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded truncate max-w-full ${
                                                                isMultiVendor
                                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 font-medium'
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}
                                                            title={p.sourcedVendors.join(', ')}
                                                        >
                                                            {isMultiVendor ? `⚡ ${p.sourcedVendors.length} เจ้า: ` : ''}
                                                            {p.sourcedVendors.join(', ')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-xs text-gray-600">
                                                    {p.buyerCount} ราย
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-xs text-gray-600">
                                                    {p.billCount} บิล
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                    {p.totalBaseQuantity.toLocaleString()} {p.baseUnit}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                    {formatCurrency(p.netSales)}
                                                </td>
                                                <td
                                                    className={`py-2.5 px-3 text-right font-medium whitespace-nowrap ${
                                                        p.grossProfit >= 0 ? 'text-gray-800' : 'text-rose-600'
                                                    }`}
                                                >
                                                    {formatCurrency(p.grossProfit)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ReportPagination
                            page={products.page}
                            totalPages={products.totalPages}
                            totalItems={products.total}
                            onPageChange={onPageChange}
                            itemLabel="สินค้า"
                        />
                    </>
                )}
            </div>
        );
    }

    if (!customers) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
            <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                    🏆 อันดับลูกค้าที่ซื้อสินค้าของผู้ขายนี้ ({customers.total.toLocaleString()} ราย)
                </h3>
                <p className="text-xs text-gray-400">
                    คลิกที่แถวลูกค้าเพื่อกางดูรายการสินค้าที่ลูกค้ารายนั้นซื้อไปอย่างละเอียด
                </p>
            </div>

            {customers.rows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    ไม่พบลูกค้าที่ตรงตามเกณฑ์โปรโมชั่นในช่วงเวลาที่เลือก
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                    <th className="text-center py-2.5 px-2 font-semibold w-14">อันดับ</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">ลูกค้า</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">เบอร์โทร</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">กลุ่ม</th>
                                    <th className="text-center py-2.5 px-2 font-semibold">จำนวนบิล</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">จำนวนหน่วยรวม</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">ยอดซื้อสุทธิ</th>
                                    <th className="text-right py-2.5 px-2 font-semibold">สัดส่วน</th>
                                    <th className="text-right py-2.5 px-3 font-semibold">กำไรขั้นต้น</th>
                                    <th className="text-left py-2.5 px-3 font-semibold">ซื้อล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {customers.rows.map((cust) => {
                                    const isExpanded = expandedKey === cust.customerKey;
                                    const breakdown = breakdownMap[cust.customerKey] || [];

                                    return (
                                        <React.Fragment key={cust.customerKey}>
                                            <tr
                                                onClick={() => toggleCustomerRow(cust.customerKey)}
                                                className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                                            >
                                                <td className="py-2.5 px-2 text-center text-xs whitespace-nowrap">
                                                    {renderRankBadge(cust.rank)}
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-800">
                                                    <span className="text-xs text-gray-400 mr-1.5">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                    {cust.customerName}
                                                    <span className="text-xs text-gray-400 ml-1.5">
                                                        ({cust.distinctProductCount} สินค้า)
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-600 whitespace-nowrap">
                                                    {cust.phone || <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                        {cust.customerGroupName}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center text-xs text-gray-600">
                                                    {cust.billCount} บิล
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                    {cust.totalBaseQuantity.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                    {formatCurrency(cust.netSales)}
                                                </td>
                                                <td className="py-2.5 px-2 text-right text-xs text-gray-500 whitespace-nowrap">
                                                    {cust.salesSharePct}%
                                                </td>
                                                <td
                                                    className={`py-2.5 px-3 text-right font-medium whitespace-nowrap ${
                                                        cust.grossProfit >= 0 ? 'text-gray-800' : 'text-rose-600'
                                                    }`}
                                                >
                                                    {formatCurrency(cust.grossProfit)}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                                                    {formatDate(cust.lastPurchaseAt)}
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={10} className="bg-gray-50/80 px-4 py-3">
                                                        {loadingKey === cust.customerKey ? (
                                                            <p className="text-xs text-gray-400 py-3 text-center">
                                                                กำลังโหลดรายการสินค้าที่ {cust.customerName} ซื้อ...
                                                            </p>
                                                        ) : breakdown.length === 0 ? (
                                                            <p className="text-xs text-gray-400 py-2 text-center">
                                                                ไม่พบรายการสินค้า
                                                            </p>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                    <thead>
                                                                        <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                                                                            <th className="py-2 px-3 text-left">รหัส</th>
                                                                            <th className="py-2 px-3 text-left">ชื่อสินค้า</th>
                                                                            <th className="py-2 px-3 text-left">ผู้ขายที่ส่งสินค้านี้</th>
                                                                            <th className="py-2 px-3 text-center">จำนวนบิล</th>
                                                                            <th className="py-2 px-3 text-right">จำนวนซื้อสุทธิ</th>
                                                                            <th className="py-2 px-3 text-right">ยอดซื้อสุทธิ</th>
                                                                            <th className="py-2 px-3 text-right">กำไรขั้นต้น</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {breakdown.map((item) => {
                                                                            const multi = item.sourcedVendors.length > 1;
                                                                            return (
                                                                                <tr key={item.productId} className="hover:bg-gray-50">
                                                                                    <td className="py-2 px-3 font-mono text-gray-500 whitespace-nowrap">
                                                                                        {item.productCode}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 font-medium text-gray-800">
                                                                                        {item.productName}
                                                                                    </td>
                                                                                    <td className="py-2 px-3">
                                                                                        {item.sourcedVendors.length > 0 ? (
                                                                                            <span
                                                                                                className={`inline-block px-2 py-0.5 rounded ${
                                                                                                    multi
                                                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200 font-medium'
                                                                                                        : 'text-gray-600'
                                                                                                }`}
                                                                                            >
                                                                                                {multi ? `⚡ รับจาก ${item.sourcedVendors.length} เจ้า: ` : ''}
                                                                                                {item.sourcedVendors.join(', ')}
                                                                                            </span>
                                                                                        ) : (
                                                                                            '-'
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-center text-gray-600">
                                                                                        {item.billCount} บิล
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                                                                        {item.totalBaseQuantity.toLocaleString()} {item.baseUnit}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                                                                                        {formatCurrency(item.netSales)}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-right text-gray-700 whitespace-nowrap">
                                                                                        {formatCurrency(item.grossProfit)}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
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
                        page={customers.page}
                        totalPages={customers.totalPages}
                        totalItems={customers.total}
                        onPageChange={onPageChange}
                        itemLabel="ราย"
                    />
                </>
            )}
        </div>
    );
}
