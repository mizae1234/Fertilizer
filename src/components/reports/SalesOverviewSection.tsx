'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import DailySalesBarChart, { type DailySalePoint } from './DailySalesBarChart';

export interface SalesWarehouseBreakdown {
    warehouseId: string;
    warehouseName: string;
    totalAmount: number;
    billCount: number;
    itemCount: number;
}

export interface PaymentChannelSummary {
    total: number;
    count: number;
}

export interface SalesOverviewData {
    totalAmount: number;
    totalCount: number;
    byWarehouse: SalesWarehouseBreakdown[];
    byPaymentMethod: {
        cash: PaymentChannelSummary;
        transfer: PaymentChannelSummary;
        cheque: PaymentChannelSummary;
        credit: PaymentChannelSummary;
    };
    dailySales: DailySalePoint[];
}

interface SalesOverviewSectionProps {
    salesData: SalesOverviewData;
    onExport: () => void;
}

const PAYMENT_CARD_CONFIG = [
    {
        key: 'cash' as const,
        label: '💵 เงินสด',
        bgClass: 'bg-emerald-50 border-emerald-100/80',
        labelClass: 'text-emerald-700',
        valueClass: 'text-emerald-600',
    },
    {
        key: 'transfer' as const,
        label: '📱 เงินโอน',
        bgClass: 'bg-blue-50 border-blue-100/80',
        labelClass: 'text-blue-700',
        valueClass: 'text-blue-600',
    },
    {
        key: 'cheque' as const,
        label: '📑 เช็ค',
        bgClass: 'bg-purple-50 border-purple-100/80',
        labelClass: 'text-purple-700',
        valueClass: 'text-purple-600',
    },
    {
        key: 'credit' as const,
        label: '⏳ เครดิต/ค้างชำระ',
        bgClass: 'bg-orange-50 border-orange-100/80',
        labelClass: 'text-orange-700',
        valueClass: 'text-orange-600',
    },
] as const;

export default function SalesOverviewSection({
    salesData,
    onExport,
}: SalesOverviewSectionProps) {
    const avgPerBill =
        salesData.totalCount > 0 ? salesData.totalAmount / salesData.totalCount : 0;
    const warehouseSum = salesData.byWarehouse.reduce((s, w) => s + w.totalAmount, 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={onExport}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                >
                    📥 Export สรุป
                </button>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-xs">
                    <p className="text-emerald-100 text-xs">ยอดขายรวมสุทธิ</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">
                        {formatCurrency(salesData.totalAmount)}
                    </p>
                    <p className="text-emerald-100 text-xs mt-1">
                        จากทั้งหมด <strong>{salesData.totalCount.toLocaleString()}</strong> บิล
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-center">
                    <p className="text-gray-400 text-xs">ยอดเฉลี่ยต่อบิล</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">
                        {formatCurrency(avgPerBill)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        เฉลี่ยวันละ{' '}
                        {salesData.dailySales.length > 0
                            ? `${Math.round(salesData.totalCount / salesData.dailySales.length)} บิล`
                            : '0 บิล'}
                    </p>
                </div>
            </div>

            {/* Warehouse & Payment Channels Side-by-Side on Large Screens for Balanced Proportions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {salesData.byWarehouse.length > 0 && (
                    <div className="lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <h3 className="font-semibold text-gray-800 text-sm mb-3">
                            🏭 สัดส่วนยอดขายแยกตามคลัง
                        </h3>
                        <div className="space-y-3">
                            {salesData.byWarehouse.map((wh) => {
                                const sharePct =
                                    warehouseSum > 0
                                        ? Math.round((wh.totalAmount / warehouseSum) * 1000) / 10
                                        : 0;
                                return (
                                    <div key={wh.warehouseId} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                <span className="text-gray-700 font-medium truncate">
                                                    {wh.warehouseName}
                                                </span>
                                                <span className="text-xs text-gray-400 shrink-0">
                                                    ({sharePct}%)
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-semibold text-gray-800">
                                                    {formatCurrency(wh.totalAmount)}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1.5">
                                                    ({wh.billCount.toLocaleString()} บิล)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, sharePct)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div
                    className={`${
                        salesData.byWarehouse.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                    } bg-white rounded-xl border border-gray-100 shadow-sm p-5`}
                >
                    <h3 className="font-semibold text-gray-800 text-sm mb-3">
                        💳 แยกตามช่องทางการชำระ
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PAYMENT_CARD_CONFIG.map((cfg) => {
                            const stat = salesData.byPaymentMethod[cfg.key];
                            const pct =
                                salesData.totalAmount > 0
                                    ? Math.round((stat.total / salesData.totalAmount) * 100)
                                    : 0;
                            return (
                                <div
                                    key={cfg.key}
                                    className={`${cfg.bgClass} rounded-xl p-3.5 text-center border`}
                                >
                                    <p className={`text-xs font-medium ${cfg.labelClass}`}>
                                        {cfg.label}
                                    </p>
                                    <p className={`text-base font-bold mt-1.5 ${cfg.valueClass}`}>
                                        {formatCurrency(stat.total)}
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {stat.count.toLocaleString()} บิล ({pct}%)
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Daily Sales Bar Chart */}
            <DailySalesBarChart dailySales={salesData.dailySales} />
        </div>
    );
}
