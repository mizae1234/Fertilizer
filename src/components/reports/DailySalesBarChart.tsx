'use client';

import React, { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';

export interface DailySalePoint {
    date: string;
    total: number;
    count: number;
}

interface DailySalesBarChartProps {
    dailySales: DailySalePoint[];
}

const MIN_VISIBLE_BAR_PCT = 4;

function formatShortDayMonth(isoDate: string, showMonth: boolean): string {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return '';
    const day = parsed.getDate();
    if (!showMonth) return String(day);
    return `${day}/${parsed.getMonth() + 1}`;
}

function formatFullThaiDate(isoDate: string): string {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return parsed.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
    });
}

export default function DailySalesBarChart({ dailySales }: DailySalesBarChartProps) {
    const stats = useMemo(() => {
        if (dailySales.length === 0) {
            return { maxTotal: 1, avgTotal: 0, peakDay: null as DailySalePoint | null, spanMultipleMonths: false };
        }
        let maxTotal = 0;
        let sumTotal = 0;
        let peakDay: DailySalePoint = dailySales[0];
        const months = new Set<string>();

        for (const point of dailySales) {
            sumTotal += point.total;
            if (point.total > maxTotal) {
                maxTotal = point.total;
                peakDay = point;
            }
            if (point.date.length >= 7) {
                months.add(point.date.slice(0, 7));
            }
        }

        return {
            maxTotal: Math.max(maxTotal, 1),
            avgTotal: sumTotal / dailySales.length,
            peakDay,
            spanMultipleMonths: months.size > 1,
        };
    }, [dailySales]);

    if (dailySales.length === 0) return null;

    const midAxisValue = stats.maxTotal / 2;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {/* Header & Summary Stats */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                    <h3 className="font-semibold text-gray-800 text-sm">
                        📊 กราฟยอดขายรายวัน ({dailySales.length} วันที่มีรายการขาย)
                    </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                        เฉลี่ย/วัน: <strong>{formatCurrency(stats.avgTotal)}</strong>
                    </span>
                    {stats.peakDay && (
                        <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-medium">
                            สูงสุด ({formatFullThaiDate(stats.peakDay.date)}):{' '}
                            <strong>{formatCurrency(stats.peakDay.total)}</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Chart Area with Y-Axis Labels & Proportional Bar Columns */}
            <div className="flex gap-3">
                {/* Y-axis scale */}
                <div className="hidden sm:flex flex-col justify-between h-44 pb-6 text-[10px] text-gray-400 text-right shrink-0 select-none">
                    <span>{formatCurrency(stats.maxTotal)}</span>
                    <span>{formatCurrency(midAxisValue)}</span>
                    <span>฿0</span>
                </div>

                {/* Scrollable Plot Container */}
                <div className="relative flex-1 overflow-x-auto pb-1">
                    {/* Horizontal guide lines aligned to the 152px (h-38 / h-[152px]) bar track */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-[152px] flex flex-col justify-between">
                        <div className="border-b border-dashed border-gray-100 w-full" />
                        <div className="border-b border-dashed border-gray-100 w-full" />
                        <div className="border-b border-gray-200 w-full" />
                    </div>

                    <div className="relative flex items-end gap-1.5 min-w-full w-max">
                        {dailySales.map((point) => {
                            const heightPct =
                                point.total > 0
                                    ? Math.max((point.total / stats.maxTotal) * 100, MIN_VISIBLE_BAR_PCT)
                                    : 0;
                            const isPeak = stats.peakDay?.date === point.date && point.total > 0;

                            return (
                                <div
                                    key={point.date}
                                    className="flex-1 min-w-[30px] max-w-[64px] flex flex-col items-center group relative"
                                >
                                    {/* Hover Tooltip */}
                                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 z-20 bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                        <p className="font-semibold text-emerald-300">
                                            {formatFullThaiDate(point.date)}
                                        </p>
                                        <p>{formatCurrency(point.total)}</p>
                                        <p className="text-[10px] text-gray-300">{point.count} บิล</p>
                                    </div>

                                    {/* Fixed-height bar track so percentage height always resolves accurately */}
                                    <div className="h-[152px] w-full flex items-end justify-center px-0.5">
                                        <div
                                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 cursor-pointer ${
                                                isPeak
                                                    ? 'bg-gradient-to-t from-emerald-600 to-amber-400 shadow-xs'
                                                    : 'bg-gradient-to-t from-emerald-500 to-teal-400 group-hover:from-emerald-600 group-hover:to-teal-500'
                                            }`}
                                            style={{ height: `${heightPct}%` }}
                                            title={`${formatFullThaiDate(point.date)}: ${formatCurrency(point.total)} (${point.count} บิล)`}
                                        />
                                    </div>

                                    {/* X-axis label */}
                                    <span className="h-6 flex items-center text-[10px] text-gray-500 font-medium select-none">
                                        {formatShortDayMonth(point.date, stats.spanMultipleMonths)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
