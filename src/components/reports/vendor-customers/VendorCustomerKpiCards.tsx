'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import type { VendorCustomerKpiSummary } from '@/types/vendor-customer-report';

interface VendorCustomerKpiCardsProps {
    summary: VendorCustomerKpiSummary;
}

export default function VendorCustomerKpiCards({ summary }: VendorCustomerKpiCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-xs">
                <p className="text-emerald-100 text-xs">ลูกค้าที่เข้าเกณฑ์โปรโมชั่น</p>
                <p className="text-2xl font-bold mt-1">
                    {summary.qualifiedCustomerCount.toLocaleString()}{' '}
                    <span className="text-sm font-normal">ราย</span>
                </p>
                <p className="text-emerald-100 text-xs mt-1">
                    จาก {summary.totalBillCount.toLocaleString()} บิล ·{' '}
                    {summary.matchedProductCount.toLocaleString()} สินค้าที่ขายออก
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
                <p className="text-gray-400 text-xs">จำนวนหน่วยขายสุทธิรวม</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                    {summary.totalBaseQuantity.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-gray-500">หน่วยพื้นฐาน</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                    หักยอดรับคืนสินค้า (Sale Return) เรียบร้อยแล้ว
                </p>
            </div>

            <div className="bg-white rounded-xl border border-emerald-100 shadow-xs p-4">
                <p className="text-gray-500 text-xs">ยอดขายสุทธิรวม (เฉพาะสินค้าผู้ขายนี้)</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                    {formatCurrency(summary.totalNetSales)}
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                    ต้นทุนขายรวม {formatCurrency(summary.totalCogs)}
                </p>
            </div>

            <div
                className={`bg-white rounded-xl border shadow-xs p-4 ${
                    summary.totalGrossProfit >= 0 ? 'border-emerald-100' : 'border-rose-100'
                }`}
            >
                <p className="text-gray-400 text-xs">กำไรขั้นต้นรวม (ช่วยคำนวณงบทำโปร)</p>
                <p
                    className={`text-lg font-bold mt-1 ${
                        summary.totalGrossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                >
                    {formatCurrency(summary.totalGrossProfit)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1.5">
                    อัตรากำไรขั้นต้น (Margin): <strong>{summary.grossMarginPct}%</strong>
                </p>
            </div>
        </div>
    );
}
