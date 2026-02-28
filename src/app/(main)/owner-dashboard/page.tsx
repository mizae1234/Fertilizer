'use client';

import { useState, useEffect, useCallback } from 'react';

interface DashboardData {
    summary: {
        totalSales: number;
        prevTotalSales: number;
        netProfit: number;
        totalExpenses: number;
        totalItemsSold: number;
        prevTotalItemsSold: number;
        totalBills: number;
        avgPerBill: number;
    };
    dailySales: { date: string; amount: number }[];
    expenseByCategory: Record<string, number>;
    topProducts: { name: string; code: string; quantitySold: number; totalRevenue: number }[];
    deadStock: { name: string; code: string; totalStock: number; soldLast30: number }[];
}

type Preset = 'this_month' | 'prev_month' | '7d' | '30d' | 'custom';

function formatCurrency(n: number) {
    return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPresetDates(preset: Preset): { from: string; to: string } {
    const now = new Date();
    if (preset === 'this_month') {
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
            to: now.toISOString().split('T')[0],
        };
    }
    if (preset === 'prev_month') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
            from: prev.toISOString().split('T')[0],
            to: lastDay.toISOString().split('T')[0],
        };
    }
    if (preset === '7d') {
        const d = new Date(now.getTime() - 6 * 86400000);
        return { from: d.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    // 30d
    const d = new Date(now.getTime() - 29 * 86400000);
    return { from: d.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
}

export default function OwnerDashboardPage() {
    const [preset, setPreset] = useState<Preset>('30d');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: string, to: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/owner-dashboard?from=${from}&to=${to}`);
            const d = await res.json();
            setData(d);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        const { from, to } = getPresetDates('30d');
        setDateFrom(from);
        setDateTo(to);
        fetchData(from, to);
    }, [fetchData]);

    const handlePreset = (p: Preset) => {
        setPreset(p);
        if (p !== 'custom') {
            const { from, to } = getPresetDates(p);
            setDateFrom(from);
            setDateTo(to);
            fetchData(from, to);
        }
    };

    const handleDateChange = () => {
        if (dateFrom && dateTo) {
            setPreset('custom');
            fetchData(dateFrom, dateTo);
        }
    };

    const salesChange = data && data.summary.prevTotalSales > 0
        ? ((data.summary.totalSales - data.summary.prevTotalSales) / data.summary.prevTotalSales * 100)
        : 0;

    const expensePercent = data && data.summary.totalSales > 0
        ? (data.summary.totalExpenses / data.summary.totalSales * 100)
        : 0;

    const maxDailySales = data ? Math.max(...data.dailySales.map(d => d.amount), 1) : 1;

    // Date display
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const now = new Date();
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear() + 543}`;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-2xl">🔮</span> Owner Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">ภาพรวมธุรกิจ — {monthLabel}</p>
                </div>
                <button onClick={() => fetchData(dateFrom, dateTo)}
                    className="self-start px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                    🔄 รีเฟรช
                </button>
            </div>

            {/* Date Filter */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-2">
                {[
                    { key: 'this_month' as Preset, label: 'เดือนนี้' },
                    { key: 'prev_month' as Preset, label: 'เดือนก่อน' },
                    { key: '7d' as Preset, label: '7 วัน' },
                    { key: '30d' as Preset, label: '30 วัน' },
                ].map(p => (
                    <button key={p.key} onClick={() => handlePreset(p.key)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${preset === p.key
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {p.label}
                    </button>
                ))}
                <div className="flex items-center gap-2 ml-2">
                    <span className="text-gray-400 text-sm">📅</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    <span className="text-gray-400 text-sm">ถึง</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    <button onClick={handleDateChange}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700">ดู</button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">⏳ กำลังโหลดข้อมูล...</div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                        {/* Total Sales */}
                        <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-teal-400 to-teal-600 relative overflow-hidden">
                            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">💰</div>
                            <p className="text-xs text-white/80 font-medium">ยอดขายรวม</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.totalSales)}</p>
                            <p className="text-xs mt-2 text-white/70">
                                {salesChange >= 0 ? '↗' : '↘'} {salesChange.toFixed(1)}% จากช่วงก่อน
                            </p>
                        </div>
                        {/* Net Profit */}
                        <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-indigo-400 to-purple-600 relative overflow-hidden">
                            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">📊</div>
                            <p className="text-xs text-white/80 font-medium">กำไรสุทธิ</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.netProfit)}</p>
                            <p className="text-xs mt-2 text-white/70">↪ หักค่าใช้จ่าย {formatCurrency(data.summary.totalExpenses)}</p>
                        </div>
                        {/* Items Sold */}
                        <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-cyan-400 to-blue-500 relative overflow-hidden">
                            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">🛒</div>
                            <p className="text-xs text-white/80 font-medium">จำนวนชิ้นขาย</p>
                            <p className="text-2xl font-bold mt-1">{data.summary.totalItemsSold.toLocaleString()} ชิ้น</p>
                            <p className="text-xs mt-2 text-white/70">↪ จาก {data.summary.totalBills} บิล</p>
                        </div>
                        {/* Avg per Bill */}
                        <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-amber-400 to-orange-500 relative overflow-hidden">
                            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">📋</div>
                            <p className="text-xs text-white/80 font-medium">เฉลี่ยต่อบิล</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.avgPerBill)}</p>
                            <p className="text-xs mt-2 text-white/70">↪ รวม {data.summary.totalBills} บิล</p>
                        </div>
                        {/* Total Expenses */}
                        <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-rose-400 to-pink-600 relative overflow-hidden">
                            <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">💸</div>
                            <p className="text-xs text-white/80 font-medium">ค่าใช้จ่ายรวม</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(data.summary.totalExpenses)}</p>
                            <p className="text-xs mt-2 text-white/70">↪ {expensePercent.toFixed(1)}% ของยอดขาย</p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {/* Daily Sales Bar Chart */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">📊 ยอดขายรายวัน</h2>
                            {data.dailySales.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลยอดขายในช่วงนี้</p>
                            ) : (
                                <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
                                    {data.dailySales.map((d, i) => {
                                        const h = Math.max((d.amount / maxDailySales) * 100, 2);
                                        const dayLabel = new Date(d.date).getDate().toString();
                                        return (
                                            <div key={i} className="flex flex-col items-center flex-1 min-w-[16px] group relative">
                                                {/* Tooltip */}
                                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                    {new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                    <br />{formatCurrency(d.amount)}
                                                </div>
                                                <div
                                                    className="w-full rounded-t-md bg-gradient-to-t from-teal-500 to-emerald-400 hover:from-teal-600 hover:to-emerald-500 transition-all cursor-pointer"
                                                    style={{ height: `${h}%` }}
                                                />
                                                <span className="text-[9px] text-gray-400 mt-1">{dayLabel}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Expense by Category */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">💸 ค่าใช้จ่ายตามประเภท</h2>
                            {Object.keys(data.expenseByCategory).length === 0 ? (
                                <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลค่าใช้จ่าย</p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(data.expenseByCategory)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([cat, amount]) => {
                                            const pct = data.summary.totalExpenses > 0 ? (amount / data.summary.totalExpenses * 100) : 0;
                                            const colors = ['from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-teal-500 to-emerald-500', 'from-indigo-500 to-blue-500'];
                                            const colorIdx = Object.keys(data.expenseByCategory).indexOf(cat) % colors.length;
                                            return (
                                                <div key={cat}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-gray-700 font-medium">{cat}</span>
                                                        <span className="text-gray-500">{formatCurrency(amount)} ({pct.toFixed(0)}%)</span>
                                                    </div>
                                                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full bg-gradient-to-r ${colors[colorIdx]} transition-all`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Top 10 Products */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">🏆 Top 10 สินค้าขายดี</h2>
                            {data.topProducts.length === 0 ? (
                                <p className="text-center text-gray-400 py-4">ไม่มีข้อมูล</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.topProducts.map((p, i) => {
                                        const maxQty = data.topProducts[0]?.quantitySold || 1;
                                        const pct = (p.quantitySold / maxQty) * 100;
                                        const medals = ['🥇', '🥈', '🥉'];
                                        return (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-lg w-8 text-center">{medals[i] || `${i + 1}`}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                                                        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">{p.quantitySold} ชิ้น · {formatCurrency(p.totalRevenue)}</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Dead Stock */}
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">⚠️ Dead Stock (สต็อกเหลือมาก - ขายน้อย)</h2>
                            {data.deadStock.length === 0 ? (
                                <p className="text-center text-gray-400 py-4">ไม่มีข้อมูล</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2">สินค้า</th>
                                                <th className="text-right text-xs font-semibold text-gray-500 py-2 px-2">คงเหลือ</th>
                                                <th className="text-right text-xs font-semibold text-gray-500 py-2 px-2">ขายได้ (30 วัน)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {data.deadStock.map((s, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="py-2 px-2">
                                                        <p className="text-sm text-gray-800">{s.name}</p>
                                                        <p className="text-xs text-gray-400">{s.code}</p>
                                                    </td>
                                                    <td className="text-right py-2 px-2">
                                                        <span className="text-sm font-semibold text-red-600">{s.totalStock.toLocaleString()}</span>
                                                    </td>
                                                    <td className="text-right py-2 px-2">
                                                        <span className={`text-sm font-medium ${s.soldLast30 === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                                                            {s.soldLast30 === 0 ? 'ยังไม่ขาย' : s.soldLast30.toLocaleString()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
