'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import type { GoodsReceiveKpiSummary as SummaryType } from '@/types/goods-receive-report';

interface GoodsReceiveKpiSummaryProps {
    summary: SummaryType;
}

export default function GoodsReceiveKpiSummary({ summary }: GoodsReceiveKpiSummaryProps) {
    const logisticsTotal = summary.shippingTotal + summary.unloadingTotal;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Bills & Quantity */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-xs">
                <p className="text-emerald-100 text-xs">จำนวนรับเข้า (เฉพาะบิลอนุมัติแล้ว)</p>
                <p className="text-2xl font-bold mt-1">
                    {summary.billCount.toLocaleString()} <span className="text-sm font-normal">บิล</span>
                </p>
                <p className="text-emerald-100 text-xs mt-1">
                    รวม <strong>{summary.totalQuantity.toLocaleString()}</strong> หน่วย ·{' '}
                    {summary.distinctProductCount.toLocaleString()} สินค้า ·{' '}
                    {summary.vendorCount.toLocaleString()} บริษัท
                </p>
            </div>

            {/* 2. Gross & Bill Discount */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <p className="text-gray-400 text-xs">ยอดค่าสินค้าก่อนลด</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                    {formatCurrency(summary.grossAmount)}
                </p>
                <p className="text-xs mt-1.5 text-amber-600 font-medium">
                    ส่วนลดท้ายบิลรวม: -{formatCurrency(summary.discountAmount)}
                </p>
            </div>

            {/* 3. Net Purchase Amount & Payment Breakdown */}
            <div className="bg-white rounded-xl border border-emerald-100 shadow-xs p-4">
                <p className="text-gray-500 text-xs">ยอดซื้อสุทธิ (หลังหักส่วนลด)</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                    {formatCurrency(summary.netAmount)}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mt-1.5">
                    <span className="text-emerald-600">
                        ✅ จ่ายแล้ว {formatCurrency(summary.paidNetAmount)}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className={summary.unpaidNetAmount > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}>
                        ⏳ ค้างจ่าย {formatCurrency(summary.unpaidNetAmount)} ({summary.unpaidBillCount} บิล)
                    </span>
                </div>
            </div>

            {/* 4. Shipping & Unloading Fees */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <p className="text-gray-400 text-xs">
                    ค่ารถขนส่ง + ค่าลงสินค้า
                    {summary.hasItemLevelFilter ? ' (ทั้งบิลที่เกี่ยวข้อง)' : ''}
                </p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                    {formatCurrency(logisticsTotal)}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500 mt-1.5">
                    <span>🚚 ค่ารถ {formatCurrency(summary.shippingTotal)}</span>
                    <span className="text-gray-300">|</span>
                    <span>🏗️ ค่าลง {formatCurrency(summary.unloadingTotal)}</span>
                </div>
            </div>
        </div>
    );
}
