'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSalesOverview, getSalesDetail, getTopProducts, getCustomerReport } from '@/app/actions/reports';
import { getInventoryReport, getStockDetailReport, getCashFlowReport, getPnLReport, getPnLDetail } from '@/app/actions/reports';
import * as XLSX from 'xlsx';

// ==================== EXCEL EXPORT UTIL ====================
function exportToExcel(data: Record<string, unknown>[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ==================== PERIOD FILTER COMPONENT ====================
function PeriodFilter({ dateFrom, dateTo, onChange }: { dateFrom: string; dateTo: string; onChange: (from: string, to: string) => void }) {
    const setPreset = (preset: string) => {
        const now = new Date();
        const from = new Date(now);
        const to = new Date(now);
        switch (preset) {
            case 'today': break;
            case 'week': from.setDate(now.getDate() - 7); break;
            case 'month': from.setDate(1); break;
            case 'year': from.setMonth(0, 1); break;
            case 'all': onChange('', ''); return;
        }
        onChange(from.toISOString().split('T')[0], to.toISOString().split('T')[0]);
    };
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500 mr-1">📅 ช่วงเวลา:</span>
                {[
                    { key: 'today', label: 'วันนี้' },
                    { key: 'week', label: '7 วัน' },
                    { key: 'month', label: 'เดือนนี้' },
                    { key: 'year', label: 'ปีนี้' },
                    { key: 'all', label: 'ทั้งหมด' },
                ].map(p => (
                    <button key={p.key} onClick={() => setPreset(p.key)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${(!dateFrom && !dateTo && p.key === 'all') || (dateFrom && p.key !== 'all') ? '' : ''}
                            border-gray-200 text-gray-500 hover:bg-gray-50`}
                    >{p.label}</button>
                ))}
                <div className="flex items-center gap-1 ml-auto">
                    <input type="date" value={dateFrom} onChange={e => onChange(e.target.value, dateTo)}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                    <span className="text-gray-400 text-xs">ถึง</span>
                    <input type="date" value={dateTo} onChange={e => onChange(dateFrom, e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs" />
                </div>
            </div>
        </div>
    );
}

// ==================== SHARED COMPONENTS ====================
function LoadingSpinner() {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;
}
function ExportButton({ onClick, label = 'Export' }: { onClick: () => void; label?: string }) {
    return <button onClick={onClick} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all">📥 {label}</button>;
}
function Row({ label, value, color, bold, sub }: { label: string; value: string; color?: string; bold?: boolean; sub?: string }) {
    return (
        <div className="flex justify-between items-center py-1.5">
            <span className={`text-sm ${bold ? 'font-bold' : ''} text-gray-600`}>{label}</span>
            <div className="text-right">
                <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${color || 'text-gray-800'}`}>{value}</span>
                {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}
function AgingCard({ label, amount, bg, color }: { label: string; amount: number; bg: string; color: string }) {
    return (
        <div className={`${bg} rounded-lg p-3 text-center`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-sm font-bold ${color}`}>{formatCurrency(amount)}</p>
        </div>
    );
}
function DrillDownModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6 m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ==================== PAGINATION ====================
const PAGE_SIZE = 10;
function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-2 pt-3">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">← ก่อนหน้า</button>
            <span className="text-xs text-gray-500">หน้า {page} / {totalPages}</span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">ถัดไป →</button>
        </div>
    );
}

// ==================== MAIN PAGE ====================
export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'financial'>('sales');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    return (
        <div className="space-y-4">
            <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {[
                    { key: 'sales' as const, label: '💰 ยอดขาย' },
                    { key: 'inventory' as const, label: '📦 สต๊อก' },
                    { key: 'financial' as const, label: '🏦 การเงิน' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >{tab.label}</button>
                ))}
            </div>
            {activeTab === 'sales' && <SalesTab dateFrom={dateFrom} dateTo={dateTo} />}
            {activeTab === 'inventory' && <InventoryTab dateFrom={dateFrom} dateTo={dateTo} />}
            {activeTab === 'financial' && <FinancialTab dateFrom={dateFrom} dateTo={dateTo} />}
        </div>
    );
}

// ==================== SALES TAB ====================
function SalesTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
    const [section, setSection] = useState<'overview' | 'products' | 'customers' | 'detail'>('overview');
    const [salesData, setSalesData] = useState<Awaited<ReturnType<typeof getSalesOverview>> | null>(null);
    const [productData, setProductData] = useState<Awaited<ReturnType<typeof getTopProducts>> | null>(null);
    const [customerData, setCustomerData] = useState<Awaited<ReturnType<typeof getCustomerReport>> | null>(null);
    const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getSalesDetail>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailWarehouse, setDetailWarehouse] = useState('');
    const [detailPage, setDetailPage] = useState(1);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerPage, setCustomerPage] = useState(1);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerItems, setCustomerItems] = useState<{ saleNumber: string; createdAt: string; productName: string; productCode: string; quantity: number; unit: string; unitPrice: number; total: number; warehouse: string }[]>([]);
    const [loadingCustomerItems, setLoadingCustomerItems] = useState(false);
    const [customerItemSearch, setCustomerItemSearch] = useState('');
    const [customerItemPage, setCustomerItemPage] = useState(1);
    const CUST_ITEM_PAGE = 10;

    const toggleCustomerDetail = async (customerId: string) => {
        if (selectedCustomerId === customerId) { setSelectedCustomerId(null); return; }
        setSelectedCustomerId(customerId);
        setCustomerItemSearch('');
        setCustomerItemPage(1);
        setLoadingCustomerItems(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const res = await fetch(`/api/customers/${customerId}?${params.toString()}`);
            const data = await res.json();
            const rows = (data.sales || []).flatMap((sale: { saleNumber: string; createdAt: string; items: { quantity: number; unitPrice: number; totalPrice: number; product: { name: string; code: string }; warehouse: { name: string } }[] }) =>
                sale.items.map((it: { quantity: number; unitPrice: number; totalPrice: number; product: { name: string; code: string }; warehouse: { name: string } }) => ({
                    saleNumber: sale.saleNumber, createdAt: sale.createdAt,
                    productName: it.product.name, productCode: it.product.code,
                    quantity: it.quantity, unit: '', unitPrice: Number(it.unitPrice), total: Number(it.totalPrice),
                    warehouse: it.warehouse.name,
                }))
            );
            setCustomerItems(rows);
        } catch { setCustomerItems([]); }
        setLoadingCustomerItems(false);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (section === 'overview') { const d = await getSalesOverview(dateFrom, dateTo); setSalesData(JSON.parse(JSON.stringify(d))); }
            else if (section === 'products') { const d = await getTopProducts(dateFrom, dateTo); setProductData(JSON.parse(JSON.stringify(d))); }
            else if (section === 'customers') { const d = await getCustomerReport(dateFrom, dateTo); setCustomerData(JSON.parse(JSON.stringify(d))); }
            else if (section === 'detail') { const d = await getSalesDetail(dateFrom, dateTo); setDetailData(JSON.parse(JSON.stringify(d))); }
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [section, dateFrom, dateTo]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleExportSales = () => {
        if (!salesData) return;
        const rows = salesData.byWarehouse.map(w => ({ 'คลังสินค้า': w.warehouseName, 'ยอดขาย': w.totalAmount, 'จำนวนบิล': w.count }));
        rows.push({ 'คลังสินค้า': 'รวม', 'ยอดขาย': salesData.totalAmount, 'จำนวนบิล': salesData.totalCount });
        exportToExcel(rows, `รายงานยอดขาย_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };
    const handleExportProducts = () => {
        if (!productData) return;
        exportToExcel(productData.topProducts.map(p => ({ 'รหัส': p.code, 'ชื่อสินค้า': p.name, 'หมวดหมู่': p.group, 'จำนวนขาย': p.quantity, 'ยอดขาย': p.totalAmount, 'จำนวนบิล': p.orderCount })),
            `สินค้าขายดี_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };
    const handleExportCustomers = () => {
        if (!customerData) return;
        exportToExcel(customerData.map(c => ({ 'ชื่อลูกค้า': c.name, 'กลุ่ม': c.group, 'โทร': c.phone, 'จำนวนบิล': c.orderCount, 'ยอดซื้อรวม': c.totalAmount })),
            `รายงานลูกค้า_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };
    const handleExportDetail = () => {
        if (!detailData) return;
        const rows: Record<string, unknown>[] = [];
        for (const s of detailData) {
            for (const item of s.items) {
                rows.push({
                    'เลขที่': s.saleNumber, 'ลูกค้า': s.customer, 'วันที่': new Date(s.createdAt).toLocaleDateString('th-TH'), 'ชำระ': s.paymentMethod,
                    'สินค้า': item.productName, 'รหัส': item.productCode, 'คลัง': item.warehouse, 'จำนวน': item.quantity, 'ราคา/หน่วย': item.unitPrice, 'รวม': item.totalPrice
                });
            }
        }
        exportToExcel(rows, `รายละเอียดขาย_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'overview' as const, label: '📊 ยอดขายรวม' },
                    { key: 'products' as const, label: '🏆 ตามสินค้า' },
                    { key: 'customers' as const, label: '👥 ตามลูกค้า' },
                    { key: 'detail' as const, label: '📋 รายละเอียด' },
                ].map(s => (
                    <button key={s.key} onClick={() => setSection(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${section === s.key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >{s.label}</button>
                ))}
            </div>

            {loading ? <LoadingSpinner /> : (
                <>
                    {section === 'overview' && salesData && (
                        <div className="space-y-4">
                            <div className="flex justify-end gap-2"><ExportButton onClick={handleExportSales} label="Export สรุป" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
                                    <p className="text-emerald-100 text-xs">ยอดขายรวม</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(salesData.totalAmount)}</p>
                                    <p className="text-emerald-200 text-xs mt-1">{salesData.totalCount} รายการ</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <p className="text-gray-400 text-xs">เฉลี่ยต่อบิล</p>
                                    <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(salesData.totalCount > 0 ? salesData.totalAmount / salesData.totalCount : 0)}</p>
                                </div>
                            </div>
                            {salesData.byWarehouse.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <h3 className="font-semibold text-gray-800 text-sm mb-3">🏭 แยกตามคลัง</h3>
                                    {salesData.byWarehouse.map(wh => (
                                        <div key={wh.warehouseId} className="flex items-center justify-between py-1.5">
                                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm text-gray-700">{wh.warehouseName}</span></div>
                                            <div className="text-right"><span className="text-sm font-semibold text-gray-800">{formatCurrency(wh.totalAmount)}</span><span className="text-xs text-gray-400 ml-2">({wh.count} บิล)</span></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {salesData.dailySales.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <h3 className="font-semibold text-gray-800 text-sm mb-3">📊 กราฟยอดขายรายวัน</h3>
                                    <div className="flex items-end gap-1 h-32 overflow-x-auto">
                                        {salesData.dailySales.map((d, i) => {
                                            const max = Math.max(...salesData.dailySales.map(x => x.total), 1);
                                            return (
                                                <div key={i} className="flex flex-col items-center min-w-[24px] group">
                                                    <div className="w-5 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-sm hover:from-emerald-600 hover:to-teal-500 cursor-pointer"
                                                        style={{ height: `${Math.max((d.total / max) * 100, 4)}%` }}
                                                        title={`${d.date}: ${formatCurrency(d.total)} (${d.count} บิล)`} />
                                                    <span className="text-[9px] text-gray-400 mt-1">{(() => { try { const dd = new Date(d.date); return isNaN(dd.getTime()) ? '' : dd.getDate(); } catch { return ''; } })()}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {section === 'products' && productData && (
                        <div className="space-y-4">
                            <div className="flex justify-end"><ExportButton onClick={handleExportProducts} /></div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <h3 className="font-semibold text-gray-800 text-sm mb-3">🏆 สินค้าขายดี</h3>
                                {productData.topProducts.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">ไม่มีข้อมูล</p> : (
                                    <table className="w-full"><thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                                        <th className="text-left py-2 pr-2">#</th><th className="text-left py-2">สินค้า</th>
                                        <th className="text-right py-2">จำนวน</th><th className="text-right py-2">ยอดขาย</th>
                                    </tr></thead><tbody>
                                            {productData.topProducts.map((p, i) => (
                                                <tr key={p.productId} className="border-b border-gray-50">
                                                    <td className="py-2 pr-2 text-sm text-gray-400">{i + 1}</td>
                                                    <td className="py-2"><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.code} · {p.group}</p></td>
                                                    <td className="py-2 text-right text-sm text-gray-600">{p.quantity}</td>
                                                    <td className="py-2 text-right text-sm font-semibold text-emerald-600">{formatCurrency(p.totalAmount)}</td>
                                                </tr>
                                            ))}
                                        </tbody></table>
                                )}
                            </div>
                            {productData.byCategory.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <h3 className="font-semibold text-gray-800 text-sm mb-3">📁 ตามหมวดหมู่</h3>
                                    {productData.byCategory.map((c, i) => {
                                        const max = Math.max(...productData.byCategory.map(x => x.totalAmount));
                                        return (
                                            <div key={i} className="mb-2">
                                                <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{c.category}</span><span className="font-semibold text-gray-800">{formatCurrency(c.totalAmount)}</span></div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${(c.totalAmount / max) * 100}%` }} /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {productData.slowMovers.length > 0 && (
                                <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4">
                                    <h3 className="font-semibold text-orange-600 text-sm mb-3">🐌 สินค้าไม่มีการขาย</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {productData.slowMovers.map(p => (
                                            <div key={p.id} className="bg-orange-50 rounded-lg px-3 py-2">
                                                <p className="text-sm font-medium text-gray-700 truncate">{p.name}</p>
                                                <p className="text-xs text-gray-400">{p.code}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {
                        section === 'customers' && customerData && (() => {
                            const cq = customerSearch.toLowerCase().trim();
                            const filteredCustomers = cq ? customerData.filter(c => c.name.toLowerCase().includes(cq) || c.group.toLowerCase().includes(cq)) : customerData;
                            const custTotalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);
                            const custPageData = filteredCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);
                            return (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <input type="text" value={customerSearch}
                                                onChange={e => { setCustomerSearch(e.target.value); setCustomerPage(1); }}
                                                placeholder="🔍 ค้นหาลูกค้า..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                        </div>
                                        <p className="text-sm text-gray-500 shrink-0">{filteredCustomers.length} ราย</p>
                                        <ExportButton onClick={handleExportCustomers} />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        {filteredCustomers.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">ไม่พบข้อมูล</p> : (
                                            <>
                                                <table className="w-full"><thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                                                    <th className="text-left py-2">ลูกค้า</th><th className="text-right py-2">บิล</th>
                                                    <th className="text-right py-2">ยอดรวม</th>
                                                </tr></thead><tbody>
                                                        {custPageData.map(c => {
                                                            const isSelected = selectedCustomerId === c.id;
                                                            return (
                                                                <React.Fragment key={c.id}>
                                                                    <tr className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                                                                        onClick={() => toggleCustomerDetail(c.id)}>
                                                                        <td className="py-2">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-gray-400 text-xs">{isSelected ? '▾' : '▸'}</span>
                                                                                <div><p className="text-sm font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.group}</p></div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-2 text-right text-sm text-gray-600">{c.orderCount}</td>
                                                                        <td className="py-2 text-right text-sm font-semibold text-emerald-600">{formatCurrency(c.totalAmount)}</td>
                                                                    </tr>
                                                                    {isSelected && (
                                                                        <tr><td colSpan={3} className="p-0">
                                                                            <div className="bg-emerald-50/50 border-y border-emerald-100 px-4 py-3">
                                                                                {loadingCustomerItems ? (
                                                                                    <p className="text-xs text-gray-400 text-center py-3">กำลังโหลด...</p>
                                                                                ) : customerItems.length === 0 ? (
                                                                                    <p className="text-xs text-gray-400 text-center py-3">ไม่พบรายการสินค้า</p>
                                                                                ) : (() => {
                                                                                    const sq = customerItemSearch.toLowerCase().trim();
                                                                                    const filteredItems = sq ? customerItems.filter(i => i.productName.toLowerCase().includes(sq) || i.productCode.toLowerCase().includes(sq) || i.saleNumber.toLowerCase().includes(sq)) : customerItems;
                                                                                    const totalItemPages = Math.ceil(filteredItems.length / CUST_ITEM_PAGE);
                                                                                    const pagedItems = filteredItems.slice((customerItemPage - 1) * CUST_ITEM_PAGE, customerItemPage * CUST_ITEM_PAGE);
                                                                                    return (
                                                                                        <>
                                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                                <input type="text" value={customerItemSearch}
                                                                                                    onChange={e => { setCustomerItemSearch(e.target.value); setCustomerItemPage(1); }}
                                                                                                    onClick={e => e.stopPropagation()}
                                                                                                    placeholder="🔍 ค้นหาสินค้า / เลขที่บิล..."
                                                                                                    className="flex-1 px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 bg-white" />
                                                                                                <span className="text-xs text-gray-500 shrink-0">{filteredItems.length} รายการ</span>
                                                                                            </div>
                                                                                            {filteredItems.length === 0 ? (
                                                                                                <p className="text-xs text-gray-400 text-center py-2">ไม่พบสินค้าที่ค้นหา</p>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <table className="w-full text-xs">
                                                                                                        <thead><tr className="text-gray-500 border-b border-emerald-100">
                                                                                                            <th className="text-left py-1.5 font-medium">เลขที่บิล</th>
                                                                                                            <th className="text-left py-1.5 font-medium">สินค้า</th>
                                                                                                            <th className="text-left py-1.5 font-medium">รหัส</th>
                                                                                                            <th className="text-right py-1.5 font-medium">จำนวน</th>
                                                                                                            <th className="text-right py-1.5 font-medium">ราคา/หน่วย</th>
                                                                                                            <th className="text-right py-1.5 font-medium">รวม</th>
                                                                                                            <th className="text-left py-1.5 font-medium">คลัง</th>
                                                                                                        </tr></thead>
                                                                                                        <tbody>
                                                                                                            {pagedItems.map((item, idx) => (
                                                                                                                <tr key={idx} className="border-b border-emerald-50 last:border-0">
                                                                                                                    <td className="py-1.5 text-blue-600 font-medium">{item.saleNumber}</td>
                                                                                                                    <td className="py-1.5 text-gray-700 font-medium">{item.productName}</td>
                                                                                                                    <td className="py-1.5 text-gray-400">{item.productCode}</td>
                                                                                                                    <td className="py-1.5 text-right text-gray-700">{item.quantity}</td>
                                                                                                                    <td className="py-1.5 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                                                                                                                    <td className="py-1.5 text-right font-medium text-gray-800">{formatCurrency(item.total)}</td>
                                                                                                                    <td className="py-1.5 text-gray-400">{item.warehouse}</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                    {totalItemPages > 1 && (
                                                                                                        <div className="flex justify-end mt-2 text-xs text-gray-500">
                                                                                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                                                                <button disabled={customerItemPage <= 1} onClick={() => setCustomerItemPage(p => p - 1)}
                                                                                                                    className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">←</button>
                                                                                                                <span className="font-medium">{customerItemPage}/{totalItemPages}</span>
                                                                                                                <button disabled={customerItemPage >= totalItemPages} onClick={() => setCustomerItemPage(p => p + 1)}
                                                                                                                    className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">→</button>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </>
                                                                                            )}
                                                                                        </>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </td></tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody></table>
                                                <Pagination page={customerPage} totalPages={custTotalPages} onPageChange={setCustomerPage} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    }

                    {
                        section === 'detail' && detailData && (() => {
                            const warehouses = Array.from(new Set(detailData.flatMap(s => s.items.map(i => i.warehouse)))).sort();
                            const q = detailSearch.toLowerCase().trim();
                            const filtered = detailData
                                .map(sale => {
                                    const items = sale.items.filter(item => {
                                        if (detailWarehouse && item.warehouse !== detailWarehouse) return false;
                                        return true;
                                    });
                                    if (items.length === 0) return null;
                                    if (q) {
                                        const saleMatch = sale.saleNumber.toLowerCase().includes(q) || sale.customer.toLowerCase().includes(q);
                                        const itemMatch = items.some(i => i.productName.toLowerCase().includes(q) || i.productCode.toLowerCase().includes(q));
                                        if (!saleMatch && !itemMatch) return null;
                                    }
                                    return { ...sale, items };
                                })
                                .filter(Boolean) as typeof detailData;
                            const detailTotalPages = Math.ceil(filtered.length / PAGE_SIZE);
                            const pageFiltered = filtered.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE);

                            return (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <input type="text" value={detailSearch}
                                                onChange={e => { setDetailSearch(e.target.value); setDetailPage(1); }}
                                                placeholder="🔍 ค้นหา เลขที่ / ลูกค้า / สินค้า..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                        </div>
                                        <select value={detailWarehouse} onChange={e => { setDetailWarehouse(e.target.value); setDetailPage(1); }}
                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white">
                                            <option value="">🏭 คลังทั้งหมด</option>
                                            {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                        <p className="text-sm text-gray-500 shrink-0">{filtered.length} บิล · {filtered.reduce((sum, s) => sum + s.items.length, 0)} รายการ</p>
                                        <ExportButton onClick={handleExportDetail} label="Export รายละเอียด" />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                        {filtered.length === 0 ? (
                                            <p className="text-gray-400 text-sm text-center py-8">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
                                        ) : (
                                            <>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                                <th className="text-left py-2.5 px-3 font-medium">เลขที่</th>
                                                                <th className="text-left py-2.5 px-3 font-medium">ลูกค้า</th>
                                                                <th className="text-left py-2.5 px-3 font-medium">สินค้า</th>
                                                                <th className="text-left py-2.5 px-3 font-medium">คลัง</th>
                                                                <th className="text-right py-2.5 px-3 font-medium">จำนวน</th>
                                                                <th className="text-right py-2.5 px-3 font-medium">ราคา/หน่วย</th>
                                                                <th className="text-right py-2.5 px-3 font-medium">รวม</th>
                                                                <th className="text-left py-2.5 px-3 font-medium">ชำระ</th>
                                                                <th className="text-left py-2.5 px-3 font-medium">วันที่</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {pageFiltered.flatMap(sale =>
                                                                sale.items.map((item, idx) => (
                                                                    <tr key={`${sale.id}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                                                                        {idx === 0 && <td className="py-2 px-3 font-medium text-gray-800 align-top" rowSpan={sale.items.length}>{sale.saleNumber}</td>}
                                                                        {idx === 0 && <td className="py-2 px-3 text-gray-600 align-top" rowSpan={sale.items.length}>{sale.customer}</td>}
                                                                        <td className="py-2 px-3"><p className="text-gray-700">{item.productName}</p><p className="text-xs text-gray-400">{item.productCode}</p></td>
                                                                        <td className="py-2 px-3 text-gray-500">{item.warehouse}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-600">{item.quantity}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                                                                        <td className="py-2 px-3 text-right font-medium text-gray-700">{formatCurrency(item.totalPrice)}</td>
                                                                        {idx === 0 && (
                                                                            <td className="py-2 px-3 align-top" rowSpan={sale.items.length}>
                                                                                <span className={`text-xs px-2 py-0.5 rounded-full ${sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' : sale.paymentMethod === 'TRANSFER' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                                    {sale.paymentMethod === 'CASH' ? 'เงินสด' : sale.paymentMethod === 'TRANSFER' ? 'โอน' : 'เครดิต'}
                                                                                </span>
                                                                            </td>
                                                                        )}
                                                                        {idx === 0 && <td className="py-2 px-3 text-gray-500 align-top" rowSpan={sale.items.length}>{formatDate(sale.createdAt)}</td>}
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <Pagination page={detailPage} totalPages={detailTotalPages} onPageChange={setDetailPage} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    }
                </>
            )}
        </div >
    );
}

// ==================== INVENTORY TAB ====================
function InventoryTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
    const [section, setSection] = useState<'overview' | 'detail'>('overview');
    const [data, setData] = useState<Awaited<ReturnType<typeof getInventoryReport>> | null>(null);
    const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getStockDetailReport>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [drillDown, setDrillDown] = useState(false);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPage, setDetailPage] = useState(1);
    const DETAIL_PAGE_SIZE = 15;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (section === 'overview') {
                const d = await getInventoryReport(); setData(JSON.parse(JSON.stringify(d)));
            } else {
                const d = await getStockDetailReport(dateFrom, dateTo); setDetailData(JSON.parse(JSON.stringify(d)));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [section, dateFrom, dateTo]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleExportStock = () => {
        if (!data) return;
        exportToExcel(data.allStocks.map(s => ({
            'รหัสสินค้า': s.code, 'ชื่อสินค้า': s.productName, 'คลัง': s.warehouse,
            'จำนวน': s.quantity, 'ต้นทุนเฉลี่ย': s.avgCost, 'มูลค่า': s.value
        })), 'สินค้าคงคลัง');
    };

    const handleExportDetail = () => {
        if (!detailData) return;
        exportToExcel(detailData.map(d => ({
            'รหัส': d.productCode, 'สินค้า': d.productName, 'ขายไป': d.qtySold,
            'ยอดขาย': d.revenue, 'ต้นทุน': d.cogs, 'กำไร': d.profit,
            'Margin%': Math.round(d.margin * 100) / 100, 'คงเหลือ': d.stockRemaining,
        })), 'รายงานสินค้า_กำไร');
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    {[
                        { key: 'overview' as const, label: '📦 ภาพรวมสต๊อก' },
                        { key: 'detail' as const, label: '📊 สินค้า / กำไร' },
                    ].map(s => (
                        <button key={s.key} onClick={() => setSection(s.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${section === s.key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >{s.label}</button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {section === 'overview' && (
                        <>
                            <button onClick={() => setDrillDown(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">📋 ดูทั้งหมด</button>
                            <ExportButton onClick={handleExportStock} label="Export สต๊อก" />
                        </>
                    )}
                    {section === 'detail' && <ExportButton onClick={handleExportDetail} label="Export กำไร" />}
                </div>
            </div>

            {section === 'overview' && data && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                            <p className="text-blue-100 text-xs">สินค้าทั้งหมด</p>
                            <p className="text-2xl font-bold mt-1">{data.allStocks.length}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-gray-400 text-xs">มูลค่ารวม</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(data.totalValue)}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-gray-400 text-xs">จำนวนคงเหลือ</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{data.allStocks.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4">
                            <p className="text-orange-500 text-xs">⚠️ ต่ำกว่า Min</p>
                            <p className="text-lg font-bold text-orange-600 mt-1">{data.lowStockAlerts.length}</p>
                        </div>
                    </div>
                    {data.byWarehouse.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <h3 className="font-semibold text-gray-800 text-sm mb-3">🏭 แยกตามคลัง</h3>
                            {data.byWarehouse.map(wh => (
                                <div key={wh.warehouseId} className="flex items-center justify-between py-1.5">
                                    <span className="text-sm text-gray-700">{wh.warehouseName}</span>
                                    <div className="text-right"><span className="text-sm font-semibold text-gray-800">{formatCurrency(wh.totalValue)}</span><span className="text-xs text-gray-400 ml-2">({wh.totalQuantity} ชิ้น)</span></div>
                                </div>
                            ))}
                        </div>
                    )}
                    {data.lowStockAlerts.length > 0 && (
                        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4">
                            <h3 className="font-semibold text-orange-600 text-sm mb-3">⚠️ สินค้าต่ำกว่า Min Stock</h3>
                            <table className="w-full"><thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                                <th className="text-left py-2">สินค้า</th><th className="text-left py-2">คลัง</th>
                                <th className="text-right py-2">คงเหลือ</th><th className="text-right py-2">Min</th>
                            </tr></thead><tbody>
                                    {data.lowStockAlerts.map((s, i) => (
                                        <tr key={i} className="border-b border-gray-50">
                                            <td className="py-2"><p className="text-sm font-medium text-gray-800">{s.productName}</p><p className="text-xs text-gray-400">{s.code}</p></td>
                                            <td className="py-2 text-sm text-gray-600">{s.warehouse}</td>
                                            <td className="py-2 text-right text-sm font-semibold text-red-600">{s.quantity}</td>
                                            <td className="py-2 text-right text-sm text-gray-400">{s.minStock}</td>
                                        </tr>
                                    ))}
                                </tbody></table>
                        </div>
                    )}
                    <DrillDownModal open={drillDown} onClose={() => setDrillDown(false)} title="📦 รายละเอียดสต๊อกทั้งหมด">
                        <div className="flex justify-end mb-3"><ExportButton onClick={handleExportStock} /></div>
                        <table className="w-full text-sm"><thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                            <th className="text-left py-2">สินค้า</th><th className="text-left py-2">รหัส</th>
                            <th className="text-left py-2">คลัง</th><th className="text-right py-2">จำนวน</th>
                            <th className="text-right py-2">ต้นทุน</th><th className="text-right py-2">มูลค่า</th>
                        </tr></thead><tbody>
                                {data.allStocks.map((s, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="py-1.5 text-gray-800">{s.productName}</td>
                                        <td className="py-1.5 text-gray-400">{s.code}</td>
                                        <td className="py-1.5 text-gray-600">{s.warehouse}</td>
                                        <td className="py-1.5 text-right">{s.quantity}</td>
                                        <td className="py-1.5 text-right text-gray-500">{formatCurrency(s.avgCost)}</td>
                                        <td className="py-1.5 text-right font-medium">{formatCurrency(s.value)}</td>
                                    </tr>
                                ))}
                            </tbody></table>
                    </DrillDownModal>
                </>
            )}

            {section === 'detail' && detailData && (() => {
                const q = detailSearch.toLowerCase().trim();
                const filtered = q ? detailData.filter(d => d.productName.toLowerCase().includes(q) || d.productCode.toLowerCase().includes(q)) : detailData;
                const totalPages = Math.ceil(filtered.length / DETAIL_PAGE_SIZE);
                const paged = filtered.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);
                const totalRevenue = filtered.reduce((s, d) => s + d.revenue, 0);
                const totalProfit = filtered.reduce((s, d) => s + d.profit, 0);
                const totalCogs = filtered.reduce((s, d) => s + d.cogs, 0);
                const totalSold = filtered.reduce((s, d) => s + d.qtySold, 0);
                return (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <p className="text-gray-400 text-xs">สินค้าที่ขาย</p>
                                <p className="text-lg font-bold text-gray-800 mt-1">{filtered.length} รายการ</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <p className="text-gray-400 text-xs">ยอดขายรวม</p>
                                <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <p className="text-gray-400 text-xs">ต้นทุนรวม</p>
                                <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(totalCogs)}</p>
                            </div>
                            <div className={`bg-white rounded-xl border shadow-sm p-4 ${totalProfit >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
                                <p className="text-gray-400 text-xs">กำไรรวม</p>
                                <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1">
                                    <input type="text" value={detailSearch}
                                        onChange={e => { setDetailSearch(e.target.value); setDetailPage(1); }}
                                        placeholder="🔍 ค้นหาสินค้า..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                </div>
                                <span className="text-sm text-gray-500 shrink-0">{filtered.length} รายการ · ขายไป {totalSold} ชิ้น</span>
                            </div>
                            {filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">ไม่พบข้อมูล</p> : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                                                <th className="text-left py-2 px-2 font-medium">รหัส</th>
                                                <th className="text-right py-2 px-2 font-medium">ขายไป</th>
                                                <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                                                <th className="text-right py-2 px-2 font-medium">ต้นทุน</th>
                                                <th className="text-right py-2 px-2 font-medium">กำไร</th>
                                                <th className="text-right py-2 px-2 font-medium">Margin</th>
                                                <th className="text-right py-2 px-2 font-medium">คงเหลือ</th>
                                            </tr></thead>
                                            <tbody>
                                                {paged.map((d, i) => (
                                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                        <td className="py-1.5 px-2 font-medium text-gray-800">{d.productName}</td>
                                                        <td className="py-1.5 px-2 text-gray-400">{d.productCode}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-700">{d.qtySold}</td>
                                                        <td className="py-1.5 px-2 text-right text-emerald-600 font-medium">{formatCurrency(d.revenue)}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-500">{formatCurrency(d.cogs)}</td>
                                                        <td className={`py-1.5 px-2 text-right font-semibold ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(d.profit)}</td>
                                                        <td className={`py-1.5 px-2 text-right text-xs ${d.margin >= 20 ? 'text-emerald-600' : d.margin >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{d.margin.toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-700">{d.stockRemaining}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Pagination page={detailPage} totalPages={totalPages} onPageChange={setDetailPage} />
                                </>
                            )}
                        </div>
                    </>
                );
            })()}
        </div>
    );
}

// ==================== FINANCIAL TAB ====================
function FinancialTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
    const [section, setSection] = useState<'pnl' | 'pnl-bill' | 'pnl-item' | 'cashflow'>('pnl');
    const [cashData, setCashData] = useState<Awaited<ReturnType<typeof getCashFlowReport>> | null>(null);
    const [pnlData, setPnlData] = useState<Awaited<ReturnType<typeof getPnLReport>> | null>(null);
    const [pnlDetail, setPnlDetail] = useState<Awaited<ReturnType<typeof getPnLDetail>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [arSearch, setArSearch] = useState('');
    const [arDueFilter, setArDueFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
    const [arView, setArView] = useState<'bills' | 'customers' | 'detail'>('bills');
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [arDetailRows, setArDetailRows] = useState<{ customer: string; saleNumber: string; dueDate: string | null; createdAt: string; productName: string; productCode: string; unit: string; quantity: number; unitPrice: number; total: number }[]>([]);
    const [loadingArDetail, setLoadingArDetail] = useState(false);
    const [arDetailPage, setArDetailPage] = useState(1);
    const AR_DETAIL_PER_PAGE = 20;
    const [pnlBillSearch, setPnlBillSearch] = useState('');
    const [pnlBillPage, setPnlBillPage] = useState(1);
    const [pnlItemSearch, setPnlItemSearch] = useState('');
    const [pnlItemPage, setPnlItemPage] = useState(1);
    const PNL_PAGE_SIZE = 15;

    const loadArDetail = useCallback(async () => {
        if (!cashData) return;
        setLoadingArDetail(true);
        setArDetailPage(1);
        try {
            const allBills = cashData.ar.byCustomer.flatMap(c => c.items.map(i => ({ ...i, customer: c.customer })));
            const results = await Promise.all(allBills.map(async (bill) => {
                try {
                    const res = await fetch(`/api/sales/${bill.saleId}`);
                    const data = await res.json();
                    return (data.items || []).map((it: { product: { name: string; code: string; unit: string }; quantity: number; unitPrice: number; totalPrice: number }) => ({
                        customer: bill.customer, saleNumber: bill.saleNumber,
                        dueDate: bill.dueDate, createdAt: bill.createdAt,
                        productName: it.product.name, productCode: it.product.code, unit: it.product.unit,
                        quantity: it.quantity, unitPrice: Number(it.unitPrice), total: Number(it.totalPrice),
                    }));
                } catch { return []; }
            }));
            setArDetailRows(results.flat());
        } catch { setArDetailRows([]); }
        setLoadingArDetail(false);
    }, [cashData]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (section === 'cashflow') { const d = await getCashFlowReport(dateFrom, dateTo); setCashData(JSON.parse(JSON.stringify(d))); }
            else if (section === 'pnl') { const d = await getPnLReport(dateFrom, dateTo); setPnlData(JSON.parse(JSON.stringify(d))); }
            else { const d = await getPnLDetail(dateFrom, dateTo); setPnlDetail(JSON.parse(JSON.stringify(d))); }
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [section, dateFrom, dateTo]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleExportPnl = () => {
        if (!pnlData) return;
        const rows = [
            { 'รายการ': 'รายได้จากการขาย', 'จำนวน': pnlData.revenue },
            { 'รายการ': 'ต้นทุนขาย (COGS)', 'จำนวน': -pnlData.cogs },
            ...(pnlData.factoryReturnCost > 0 ? [{ 'รายการ': 'เคลมคืนโรงงาน', 'จำนวน': -pnlData.factoryReturnCost }] : []),
            { 'รายการ': 'กำไรขั้นต้น', 'จำนวน': pnlData.grossProfit },
            ...pnlData.expenseByCategory.map(e => ({ 'รายการ': `ค่าใช้จ่าย: ${e.category}`, 'จำนวน': -e.amount })),
            { 'รายการ': 'ค่าใช้จ่ายรวม', 'จำนวน': -pnlData.expenses },
            { 'รายการ': 'กำไรสุทธิ', 'จำนวน': pnlData.netProfit },
        ];
        exportToExcel(rows, `PnL_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    const handleExportPnlBill = () => {
        if (!pnlDetail) return;
        exportToExcel(pnlDetail.byBill.map(b => ({
            'เลขที่บิล': b.saleNumber, 'ลูกค้า': b.customer, 'วันที่': formatDate(b.createdAt),
            'รายการ': b.itemCount, 'ยอดขาย': b.revenue, 'ต้นทุน': b.cogs,
            'กำไร': b.profit, 'Margin%': Math.round(b.margin * 100) / 100,
        })), `PnL_รายบิล_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    const handleExportPnlItem = () => {
        if (!pnlDetail) return;
        exportToExcel(pnlDetail.byItem.map(i => ({
            'เลขที่บิล': i.saleNumber, 'ลูกค้า': i.customer, 'สินค้า': i.productName,
            'รหัส': i.productCode, 'จำนวน': i.quantity, 'ราคาขาย': i.unitPrice,
            'ต้นทุน/หน่วย': i.unitCost, 'ยอดขาย': i.revenue, 'ต้นทุน': i.cogs,
            'กำไร': i.profit, 'Margin%': Math.round(i.margin * 100) / 100,
        })), `PnL_รายสินค้า_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    const handleExportCashFlow = () => {
        if (!cashData) return;
        const rows = [
            { 'ประเภท': 'เงินสด', 'จำนวน': cashData.cashFlow.cash },
            { 'ประเภท': 'โอน', 'จำนวน': cashData.cashFlow.transfer },
            { 'ประเภท': 'เครดิต', 'จำนวน': cashData.cashFlow.credit },
            { 'ประเภท': 'รวม', 'จำนวน': cashData.cashFlow.total },
        ];
        exportToExcel(rows, `CashFlow_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    const handleExportAR = () => {
        if (!cashData) return;
        const rows: Record<string, unknown>[] = [];
        for (const cust of cashData.ar.byCustomer) {
            for (const item of cust.items) {
                rows.push({ 'ลูกค้า': cust.customer, 'เลขที่': item.saleNumber, 'จำนวน': item.amount, 'กำหนดชำระ': item.dueDate ? new Date(item.dueDate).toLocaleDateString('th-TH') : '-' });
            }
        }
        exportToExcel(rows, `ลูกหนี้_AR_${dateFrom || 'all'}_${dateTo || 'all'}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'pnl' as const, label: '📊 สรุป P&L' },
                    { key: 'pnl-bill' as const, label: '🧾 กำไรรายบิล' },
                    { key: 'pnl-item' as const, label: '📦 กำไรรายสินค้า' },
                    { key: 'cashflow' as const, label: '💵 Cash Flow & ลูกหนี้' },
                ].map(s => (
                    <button key={s.key} onClick={() => setSection(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all whitespace-nowrap ${section === s.key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >{s.label}</button>
                ))}
            </div>

            {loading ? <LoadingSpinner /> : (
                <>
                    {section === 'pnl' && pnlData && (
                        <div className="space-y-4">
                            <div className="flex justify-end"><ExportButton onClick={handleExportPnl} /></div>
                            <div className={`rounded-xl p-5 ${pnlData.netProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-orange-600'} text-white`}>
                                <p className="text-white/70 text-xs">กำไรสุทธิ</p>
                                <p className="text-3xl font-bold mt-1">{formatCurrency(pnlData.netProfit)}</p>
                                <p className="text-white/70 text-xs mt-1">Margin {pnlData.netMargin.toFixed(1)}%</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                                <Row label="รายได้จากการขาย" value={`+${formatCurrency(pnlData.revenue)}`} color="text-emerald-600" />
                                <Row label="ต้นทุนขาย (COGS)" value={`-${formatCurrency(pnlData.cogs)}`} color="text-red-600" />
                                {pnlData.factoryReturnCost > 0 && (
                                    <Row label="เคลมคืนโรงงาน" value={`-${formatCurrency(pnlData.factoryReturnCost)}`} color="text-orange-600" />
                                )}
                                <Row label="กำไรขั้นต้น" value={formatCurrency(pnlData.grossProfit)} bold sub={`${pnlData.grossMargin.toFixed(1)}%`} />
                                <Row label="ค่าใช้จ่าย" value={`-${formatCurrency(pnlData.expenses)}`} color="text-red-600" />
                                <div className={`flex justify-between items-center py-2 px-2 rounded-lg ${pnlData.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    <span className="text-sm font-bold text-gray-800">กำไรสุทธิ</span>
                                    <span className={`text-sm font-bold ${pnlData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(pnlData.netProfit)}</span>
                                </div>
                            </div>
                            {pnlData.expenseByCategory.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <h3 className="font-semibold text-gray-800 text-sm mb-3">💸 ค่าใช้จ่ายแยกหมวด</h3>
                                    {pnlData.expenseByCategory.map((e, i) => (
                                        <div key={i} className="flex justify-between items-center py-1">
                                            <span className="text-sm text-gray-600">{e.category}</span>
                                            <span className="text-sm font-medium text-gray-800">{formatCurrency(e.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {section === 'pnl-bill' && pnlDetail && (() => {
                        const q = pnlBillSearch.toLowerCase().trim();
                        const filtered = q ? pnlDetail.byBill.filter(b => b.saleNumber.toLowerCase().includes(q) || b.customer.toLowerCase().includes(q)) : pnlDetail.byBill;
                        const totalPages = Math.ceil(filtered.length / PNL_PAGE_SIZE);
                        const paged = filtered.slice((pnlBillPage - 1) * PNL_PAGE_SIZE, pnlBillPage * PNL_PAGE_SIZE);
                        const totalRevenue = filtered.reduce((s, b) => s + b.revenue, 0);
                        const totalProfit = filtered.reduce((s, b) => s + b.profit, 0);
                        const totalCogs = filtered.reduce((s, b) => s + b.cogs, 0);
                        return (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">จำนวนบิล</p>
                                        <p className="text-lg font-bold text-gray-800 mt-1">{filtered.length} บิล</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">ยอดขายรวม</p>
                                        <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">ต้นทุนรวม</p>
                                        <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(totalCogs)}</p>
                                    </div>
                                    <div className={`bg-white rounded-xl border shadow-sm p-4 ${totalProfit >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
                                        <p className="text-gray-400 text-xs">กำไรรวม</p>
                                        <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</p>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1">
                                            <input type="text" value={pnlBillSearch}
                                                onChange={e => { setPnlBillSearch(e.target.value); setPnlBillPage(1); }}
                                                placeholder="🔍 ค้นหาเลขที่บิล / ลูกค้า..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                        </div>
                                        <ExportButton onClick={handleExportPnlBill} label="Export" />
                                    </div>
                                    {filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">ไม่พบข้อมูล</p> : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                        <th className="text-left py-2 px-2 font-medium">เลขที่บิล</th>
                                                        <th className="text-left py-2 px-2 font-medium">ลูกค้า</th>
                                                        <th className="text-left py-2 px-2 font-medium">วันที่</th>
                                                        <th className="text-right py-2 px-2 font-medium">รายการ</th>
                                                        <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                                                        <th className="text-right py-2 px-2 font-medium">ต้นทุน</th>
                                                        <th className="text-right py-2 px-2 font-medium">กำไร</th>
                                                        <th className="text-right py-2 px-2 font-medium">Margin</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {paged.map((b, i) => (
                                                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                                <td className="py-1.5 px-2 text-blue-600 font-medium">{b.saleNumber}</td>
                                                                <td className="py-1.5 px-2 text-gray-700">{b.customer}</td>
                                                                <td className="py-1.5 px-2 text-gray-400 text-xs">{formatDate(b.createdAt)}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{b.itemCount}</td>
                                                                <td className="py-1.5 px-2 text-right text-emerald-600 font-medium">{formatCurrency(b.revenue)}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{formatCurrency(b.cogs)}</td>
                                                                <td className={`py-1.5 px-2 text-right font-semibold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(b.profit)}</td>
                                                                <td className={`py-1.5 px-2 text-right text-xs ${b.margin >= 20 ? 'text-emerald-600' : b.margin >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{b.margin.toFixed(1)}%</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Pagination page={pnlBillPage} totalPages={totalPages} onPageChange={setPnlBillPage} />
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {section === 'pnl-item' && pnlDetail && (() => {
                        const q = pnlItemSearch.toLowerCase().trim();
                        const filtered = q ? pnlDetail.byItem.filter(i => i.saleNumber.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q) || i.productCode.toLowerCase().includes(q)) : pnlDetail.byItem;
                        const totalPages = Math.ceil(filtered.length / PNL_PAGE_SIZE);
                        const paged = filtered.slice((pnlItemPage - 1) * PNL_PAGE_SIZE, pnlItemPage * PNL_PAGE_SIZE);
                        const totalRevenue = filtered.reduce((s, i) => s + i.revenue, 0);
                        const totalProfit = filtered.reduce((s, i) => s + i.profit, 0);
                        const totalCogs = filtered.reduce((s, i) => s + i.cogs, 0);
                        return (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">รายการทั้งหมด</p>
                                        <p className="text-lg font-bold text-gray-800 mt-1">{filtered.length} รายการ</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">ยอดขายรวม</p>
                                        <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-gray-400 text-xs">ต้นทุนรวม</p>
                                        <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(totalCogs)}</p>
                                    </div>
                                    <div className={`bg-white rounded-xl border shadow-sm p-4 ${totalProfit >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
                                        <p className="text-gray-400 text-xs">กำไรรวม</p>
                                        <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</p>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1">
                                            <input type="text" value={pnlItemSearch}
                                                onChange={e => { setPnlItemSearch(e.target.value); setPnlItemPage(1); }}
                                                placeholder="🔍 ค้นหาบิล / ลูกค้า / สินค้า..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                        </div>
                                        <ExportButton onClick={handleExportPnlItem} label="Export" />
                                    </div>
                                    {filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">ไม่พบข้อมูล</p> : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                        <th className="text-left py-2 px-2 font-medium">เลขที่บิล</th>
                                                        <th className="text-left py-2 px-2 font-medium">วันที่ขาย</th>
                                                        <th className="text-left py-2 px-2 font-medium">ลูกค้า</th>
                                                        <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                                                        <th className="text-left py-2 px-2 font-medium">รหัส</th>
                                                        <th className="text-right py-2 px-2 font-medium">จำนวน</th>
                                                        <th className="text-right py-2 px-2 font-medium">ราคาขาย</th>
                                                        <th className="text-right py-2 px-2 font-medium">ต้นทุน/หน่วย</th>
                                                        <th className="text-right py-2 px-2 font-medium">ยอดขาย</th>
                                                        <th className="text-right py-2 px-2 font-medium">ต้นทุน</th>
                                                        <th className="text-right py-2 px-2 font-medium">กำไร</th>
                                                        <th className="text-right py-2 px-2 font-medium">Margin</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {paged.map((item, i) => (
                                                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                                <td className="py-1.5 px-2 text-blue-600 font-medium">{item.saleNumber}</td>
                                                                <td className="py-1.5 px-2 text-gray-400 text-xs">{formatDate(item.createdAt)}</td>
                                                                <td className="py-1.5 px-2 text-gray-700">{item.customer}</td>
                                                                <td className="py-1.5 px-2 text-gray-700 font-medium">{item.productName}</td>
                                                                <td className="py-1.5 px-2 text-gray-400">{item.productCode}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-700">{item.quantity}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-400">{formatCurrency(item.unitCost)}</td>
                                                                <td className="py-1.5 px-2 text-right text-emerald-600 font-medium">{formatCurrency(item.revenue)}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{formatCurrency(item.cogs)}</td>
                                                                <td className={`py-1.5 px-2 text-right font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(item.profit)}</td>
                                                                <td className={`py-1.5 px-2 text-right text-xs ${item.margin >= 20 ? 'text-emerald-600' : item.margin >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{item.margin.toFixed(1)}%</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <Pagination page={pnlItemPage} totalPages={totalPages} onPageChange={setPnlItemPage} />
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {section === 'cashflow' && cashData && (
                        <div className="space-y-4">
                            <div className="flex justify-end gap-2">
                                <ExportButton onClick={handleExportCashFlow} label="Export Cash Flow" />
                                <ExportButton onClick={handleExportAR} label="Export AR" />
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <h3 className="font-semibold text-gray-800 text-sm mb-3">💵 Cash Flow</h3>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">เงินสด</p>
                                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(cashData.cashFlow.cash)}</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">โอน</p>
                                        <p className="text-sm font-bold text-blue-600">{formatCurrency(cashData.cashFlow.transfer)}</p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">เครดิต</p>
                                        <p className="text-sm font-bold text-orange-600">{formatCurrency(cashData.cashFlow.credit)}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-sm font-medium text-gray-600">ยอดรวม</span>
                                    <span className="text-lg font-bold text-gray-800">{formatCurrency(cashData.cashFlow.total)}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-800 text-sm">📋 ลูกหนี้ค้างชำระ (AR)</h3>
                                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                                        <button onClick={() => setArView('bills')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${arView === 'bills' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>📋 รายบิล</button>
                                        <button onClick={() => setArView('customers')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${arView === 'customers' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>👥 ตามลูกค้า</button>
                                        <button onClick={() => { setArView('detail'); loadArDetail(); }} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${arView === 'detail' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>📝 รายละเอียด</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                    <AgingCard label="ยังไม่ถึงกำหนด" amount={cashData.ar.aging.current} bg="bg-gray-50" color="text-gray-800" />
                                    <AgingCard label="เกิน 30 วัน" amount={cashData.ar.aging.days30} bg="bg-yellow-50" color="text-yellow-600" />
                                    <AgingCard label="เกิน 60 วัน" amount={cashData.ar.aging.days60} bg="bg-orange-50" color="text-orange-600" />
                                    <AgingCard label="เกิน 90 วัน" amount={cashData.ar.aging.days90Plus} bg="bg-red-50" color="text-red-600" />
                                </div>
                                {(() => {
                                    const aq = arSearch.toLowerCase().trim();
                                    const filterItem = (item: { dueDate?: string | null; saleNumber: string }, customer: string) => {
                                        if (aq && !customer.toLowerCase().includes(aq) && !item.saleNumber.toLowerCase().includes(aq)) return false;
                                        if (arDueFilter === 'overdue' && (!item.dueDate || new Date(item.dueDate) >= new Date())) return false;
                                        if (arDueFilter === 'upcoming' && (!item.dueDate || new Date(item.dueDate) < new Date())) return false;
                                        return true;
                                    };
                                    const allItems = cashData.ar.byCustomer.flatMap(c => c.items.filter(i => filterItem(i, c.customer)).map(i => ({ ...i, customer: c.customer })));
                                    const filteredByCustomer = cashData.ar.byCustomer.map(c => ({
                                        ...c,
                                        items: c.items.filter(i => filterItem(i, c.customer)),
                                    })).filter(c => c.items.length > 0);
                                    const toggleCustomer = (name: string) => {
                                        setExpandedCustomers(prev => {
                                            const next = new Set(prev);
                                            if (next.has(name)) next.delete(name); else next.add(name);
                                            return next;
                                        });
                                    };
                                    return (
                                        <>
                                            <div className="flex items-center gap-3 flex-wrap mb-3">
                                                <div className="flex-1 min-w-[180px]">
                                                    <input type="text" value={arSearch} onChange={e => setArSearch(e.target.value)}
                                                        placeholder="🔍 ค้นหาลูกค้า / เลขที่บิล..."
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                                                </div>
                                                <select value={arDueFilter} onChange={e => setArDueFilter(e.target.value as 'all' | 'overdue' | 'upcoming')}
                                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                                                    <option value="all">📅 ทั้งหมด</option>
                                                    <option value="overdue">⚠️ เลยกำหนด</option>
                                                    <option value="upcoming">✅ ยังไม่ถึงกำหนด</option>
                                                </select>
                                                <p className="text-sm text-gray-500 shrink-0">{allItems.length} รายการ</p>
                                            </div>

                                            {arView === 'bills' ? (
                                                allItems.length === 0 ? (
                                                    <p className="text-sm text-gray-400 text-center py-3">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                            <th className="text-left py-2 px-3 font-medium">ลูกค้า</th>
                                                            <th className="text-left py-2 px-3 font-medium">เลขที่บิล</th>
                                                            <th className="text-right py-2 px-3 font-medium">ยอด</th>
                                                            <th className="text-left py-2 px-3 font-medium">กำหนดชำระ</th>
                                                            <th className="text-left py-2 px-3 font-medium">วันที่ขาย</th>
                                                        </tr></thead>
                                                        <tbody>
                                                            {allItems.map((item, i) => {
                                                                const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
                                                                return (
                                                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                                        <td className="py-2 px-3 font-medium text-gray-800">{item.customer}</td>
                                                                        <td className="py-2 px-3 text-gray-600">{item.saleNumber}</td>
                                                                        <td className="py-2 px-3 text-right font-medium text-gray-700">{formatCurrency(item.amount)}</td>
                                                                        <td className={`py-2 px-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                                            {item.dueDate ? formatDate(item.dueDate) : '-'}
                                                                            {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                                                                        </td>
                                                                        <td className="py-2 px-3 text-gray-400">{formatDate(item.createdAt)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                )
                                            ) : arView === 'customers' ? (
                                                filteredByCustomer.length === 0 ? (
                                                    <p className="text-sm text-gray-400 text-center py-3">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                            <th className="text-left py-2 px-3 font-medium">ลูกค้า</th>
                                                            <th className="text-left py-2 px-3 font-medium">เลขที่บิล</th>
                                                            <th className="text-right py-2 px-3 font-medium">ยอด</th>
                                                            <th className="text-left py-2 px-3 font-medium">กำหนดชำระ</th>
                                                            <th className="text-left py-2 px-3 font-medium">วันที่ขาย</th>
                                                        </tr></thead>
                                                        <tbody>
                                                            {filteredByCustomer.map(cust => {
                                                                const custTotal = cust.items.reduce((s, i) => s + i.amount, 0);
                                                                return (
                                                                    <React.Fragment key={cust.customer}>
                                                                        {cust.items.map((item, j) => {
                                                                            const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
                                                                            return (
                                                                                <tr key={j} className="border-b border-gray-50 hover:bg-gray-50">
                                                                                    {j === 0 && <td className="py-2 px-3 font-semibold text-gray-800 align-top" rowSpan={cust.items.length}>{cust.customer}</td>}
                                                                                    <td className="py-2 px-3 text-gray-600">{item.saleNumber}</td>
                                                                                    <td className="py-2 px-3 text-right font-medium text-gray-700">{formatCurrency(item.amount)}</td>
                                                                                    <td className={`py-2 px-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                                                        {item.dueDate ? formatDate(item.dueDate) : '-'}
                                                                                        {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                                                                                    </td>
                                                                                    <td className="py-2 px-3 text-gray-400">{formatDate(item.createdAt)}</td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                                                                            <td colSpan={2} className="py-1.5 px-3 text-xs text-gray-500 font-medium">รวม {cust.customer} ({cust.items.length} บิล)</td>
                                                                            <td className="py-1.5 px-3 text-right text-sm font-bold text-gray-800">{formatCurrency(custTotal)}</td>
                                                                            <td colSpan={2}></td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                )
                                            ) : (
                                                loadingArDetail ? (
                                                    <p className="text-sm text-gray-400 text-center py-6">กำลังโหลดรายละเอียด...</p>
                                                ) : arDetailRows.length === 0 ? (
                                                    <p className="text-sm text-gray-400 text-center py-3">ไม่พบข้อมูล</p>
                                                ) : (() => {
                                                    const totalPages = Math.ceil(arDetailRows.length / AR_DETAIL_PER_PAGE);
                                                    const paged = arDetailRows.slice((arDetailPage - 1) * AR_DETAIL_PER_PAGE, arDetailPage * AR_DETAIL_PER_PAGE);
                                                    return (
                                                        <>
                                                            <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                                                                <span>ทั้งหมด {arDetailRows.length} รายการ</span>
                                                                <div className="flex items-center gap-2">
                                                                    <button disabled={arDetailPage <= 1} onClick={() => setArDetailPage(p => p - 1)}
                                                                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">← ก่อนหน้า</button>
                                                                    <span className="font-medium">{arDetailPage} / {totalPages}</span>
                                                                    <button disabled={arDetailPage >= totalPages} onClick={() => setArDetailPage(p => p + 1)}
                                                                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">ถัดไป →</button>
                                                                </div>
                                                            </div>
                                                            <table className="w-full text-sm">
                                                                <thead><tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                                    <th className="text-left py-2 px-2 font-medium">ลูกค้า</th>
                                                                    <th className="text-left py-2 px-2 font-medium">เลขที่บิล</th>
                                                                    <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                                                                    <th className="text-left py-2 px-2 font-medium">รหัส</th>
                                                                    <th className="text-right py-2 px-2 font-medium">จำนวน</th>
                                                                    <th className="text-right py-2 px-2 font-medium">ราคา/หน่วย</th>
                                                                    <th className="text-right py-2 px-2 font-medium">รวม</th>
                                                                    <th className="text-left py-2 px-2 font-medium">กำหนดชำระ</th>
                                                                </tr></thead>
                                                                <tbody>
                                                                    {paged.map((row, i) => {
                                                                        const isOverdue = row.dueDate && new Date(row.dueDate) < new Date();
                                                                        return (
                                                                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                                                <td className="py-1.5 px-2 font-medium text-gray-800">{row.customer}</td>
                                                                                <td className="py-1.5 px-2 text-blue-600 font-medium">{row.saleNumber}</td>
                                                                                <td className="py-1.5 px-2 text-gray-700">{row.productName}</td>
                                                                                <td className="py-1.5 px-2 text-gray-400">{row.productCode}</td>
                                                                                <td className="py-1.5 px-2 text-right text-gray-700">{row.quantity} {row.unit}</td>
                                                                                <td className="py-1.5 px-2 text-right text-gray-500">{formatCurrency(row.unitPrice)}</td>
                                                                                <td className="py-1.5 px-2 text-right font-medium text-gray-800">{formatCurrency(row.total)}</td>
                                                                                <td className={`py-1.5 px-2 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                                                                                    {row.dueDate ? formatDate(row.dueDate) : '-'}
                                                                                    {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                            {totalPages > 1 && (
                                                                <div className="flex justify-end mt-2 text-xs text-gray-500">
                                                                    <div className="flex items-center gap-2">
                                                                        <button disabled={arDetailPage <= 1} onClick={() => setArDetailPage(p => p - 1)}
                                                                            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">← ก่อนหน้า</button>
                                                                        <span className="font-medium">{arDetailPage} / {totalPages}</span>
                                                                        <button disabled={arDetailPage >= totalPages} onClick={() => setArDetailPage(p => p + 1)}
                                                                            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-100">ถัดไป →</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
