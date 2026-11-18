'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { formatCurrency } from '@/lib/utils';

interface LowStockItem {
    id: string;
    productId: string;
    code: string;
    barcode: string;
    name: string;
    category: string;
    brand: string;
    unit: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    minStock: number;
    shortage: number;
    price: number;
    cost?: number;
}

interface WarehouseOption {
    id: string;
    name: string;
}

interface LowStockSectionProps {
    initialCount: number;
    isAdmin: boolean;
    canLinkProduct: boolean;
}

export default function LowStockSection({ initialCount, isAdmin, canLinkProduct }: LowStockSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<LowStockItem[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    const [warehousesLoaded, setWarehousesLoaded] = useState(false);
    const [total, setTotal] = useState(initialCount);
    const [page, setPage] = useState(1);
    const [perPage] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [highlighted, setHighlighted] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 250);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchLowStock = useCallback(async (needWarehouses: boolean) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                perPage: String(perPage),
            });
            if (needWarehouses) params.set('includeWarehouses', '1');
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (warehouseId) params.set('warehouseId', warehouseId);

            const res = await fetch(`/api/low-stock?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            setItems(data.items || []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages || 1);
            if (Array.isArray(data.warehouses)) {
                setWarehouses(data.warehouses);
                setWarehousesLoaded(true);
            }
        } catch (err) {
            console.error('Failed to fetch low stock:', err);
        } finally {
            setLoading(false);
        }
    }, [page, perPage, debouncedSearch, warehouseId]);

    // Only fetch when section is opened by the user!
    useEffect(() => {
        if (!isOpen) return;
        fetchLowStock(!warehousesLoaded);
    }, [isOpen, fetchLowStock, warehousesLoaded]);

    // Intercept clicks on <a href="#low-stock-section"> (the top DashboardCard) to open & scroll smoothly
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest?.('a[href="#low-stock-section"]');
            if (!anchor) return;
            e.preventDefault();
            setIsOpen(true);
            setHighlighted(true);
            requestAnimationFrame(() => {
                document.getElementById('low-stock-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 400);
            setTimeout(() => setHighlighted(false), 1800);
        };

        if (window.location.hash === '#low-stock-section') {
            setIsOpen(true);
        }

        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, []);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams({ exportAll: '1' });
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (warehouseId) params.set('warehouseId', warehouseId);

            const res = await fetch(`/api/low-stock?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const exportItems: LowStockItem[] = data.items || [];

            const rows = exportItems.map((item, idx) => {
                const row: Record<string, string | number> = {
                    'ลำดับ': idx + 1,
                    'รหัสสินค้า': item.code,
                    'บาร์โค้ด': item.barcode || '',
                    'ชื่อสินค้า': item.name,
                    'หมวดหมู่': item.category || '',
                    'ยี่ห้อ': item.brand || '',
                    'คลังสินค้า': item.warehouseName,
                    'คงเหลือ': item.quantity,
                    'เกณฑ์ขั้นต่ำ': item.minStock,
                    'ต้องเติมเพิ่ม': item.shortage,
                    'หน่วย': item.unit,
                    'ราคาขาย': item.price,
                };
                if (isAdmin && item.cost !== undefined) {
                    row['ต้นทุน'] = item.cost;
                }
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [
                { wch: 7 },  // ลำดับ
                { wch: 12 }, // รหัสสินค้า
                { wch: 16 }, // บาร์โค้ด
                { wch: 32 }, // ชื่อสินค้า
                { wch: 16 }, // หมวดหมู่
                { wch: 16 }, // ยี่ห้อ
                { wch: 16 }, // คลังสินค้า
                { wch: 12 }, // คงเหลือ
                { wch: 12 }, // เกณฑ์ขั้นต่ำ
                { wch: 12 }, // ต้องเติมเพิ่ม
                { wch: 10 }, // หน่วย
                { wch: 12 }, // ราคาขาย
                ...(isAdmin ? [{ wch: 12 }] : []),
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'LowStock');
            const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `สินค้าใกล้หมด_${date}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export low stock failed:', err);
        } finally {
            setExporting(false);
        }
    };

    const startIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
    const endIdx = Math.min(page * perPage, total);

    const getPageNumbers = (): (number | '...')[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [1];
        if (page > 3) pages.push('...');
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        for (let p = start; p <= end; p++) pages.push(p);
        if (page < totalPages - 2) pages.push('...');
        pages.push(totalPages);
        return pages;
    };

    if (!isOpen) {
        return (
            <div id="low-stock-section" className="mt-6 scroll-mt-6">
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(true);
                        setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 250);
                    }}
                    className="w-full bg-white hover:bg-orange-50/40 rounded-xl shadow-md border border-orange-200 p-4 sm:p-5 flex items-center justify-between gap-3 transition-colors text-left group"
                >
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg shrink-0">
                            ⚠️
                        </span>
                        <div>
                            <p className="font-bold text-gray-800 text-sm sm:text-base group-hover:text-orange-700 transition-colors">
                                คลิกเพื่อดูรายการสินค้าใกล้หมด / Export Excel ({initialCount.toLocaleString()} รายการ)
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                โหลดข้อมูลเฉพาะเมื่อกดเปิด เพื่อให้หน้า Dashboard ทำงานเร็ว
                            </p>
                        </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold shrink-0">
                        เปิดดูรายการ ▼
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div
            id="low-stock-section"
            className={`mt-6 bg-white rounded-xl shadow-md border transition-all duration-500 scroll-mt-6 overflow-hidden ${
                highlighted ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100'
            }`}
        >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg shrink-0">
                        ⚠️
                    </span>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-bold text-gray-800 text-base sm:text-lg">สินค้าใกล้หมด / สต็อกต่ำกว่าเกณฑ์</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                                {total.toLocaleString()} รายการ
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">ค้นหาและส่งออกไฟล์ Excel สำหรับตรวจเช็คเติมสต็อก</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={exporting || total === 0}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                        {exporting ? '⏳ กำลังส่งออก...' : `📥 Export Excel (${total.toLocaleString()})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium transition-colors"
                    >
                        ซ่อน ▲
                    </button>
                </div>
            </div>

            {/* Search & Warehouse Filter */}
            <div className="p-4 bg-gray-50/60 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="🔍 ค้นหาชื่อสินค้า, รหัสสินค้า, บาร์โค้ด หรือยี่ห้อ..."
                        className="w-full pl-4 pr-9 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {warehouses.length > 1 && (
                    <select
                        value={warehouseId}
                        onChange={e => {
                            setWarehouseId(e.target.value);
                            setPage(1);
                        }}
                        className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:ring-2 focus:ring-orange-400 outline-none sm:w-52"
                    >
                        <option value="">📦 ทุกคลังสินค้า</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-7 h-7 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                    {debouncedSearch || warehouseId ? 'ไม่พบรายการสินค้าใกล้หมดที่ตรงกับเงื่อนไขการค้นหา' : '🎉 ไม่มีสินค้าที่สต็อกต่ำกว่าเกณฑ์'}
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                                    <th className="px-4 py-3 text-left w-12">#</th>
                                    <th className="px-4 py-3 text-left">รหัส</th>
                                    <th className="px-4 py-3 text-left">ชื่อสินค้า</th>
                                    <th className="px-4 py-3 text-left">หมวดหมู่ / ยี่ห้อ</th>
                                    <th className="px-4 py-3 text-left">คลังสินค้า</th>
                                    <th className="px-4 py-3 text-right">คงเหลือ</th>
                                    <th className="px-4 py-3 text-right">เกณฑ์ขั้นต่ำ</th>
                                    <th className="px-4 py-3 text-right">ต้องเติม</th>
                                    {isAdmin && <th className="px-4 py-3 text-right">ต้นทุน</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((item, idx) => {
                                    const isOut = item.quantity <= 0;
                                    const rowNumber = (page - 1) * perPage + idx + 1;
                                    return (
                                        <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                                            <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{rowNumber}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                                                {canLinkProduct ? (
                                                    <Link href={`/products/${item.productId}`} className="hover:text-emerald-600 hover:underline font-medium">
                                                        {item.code}
                                                    </Link>
                                                ) : (
                                                    item.code
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {canLinkProduct ? (
                                                    <Link href={`/products/${item.productId}`} className="font-medium text-gray-800 hover:text-emerald-600 hover:underline">
                                                        {item.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-gray-800">{item.name}</span>
                                                )}
                                                {item.barcode && (
                                                    <p className="text-[11px] text-gray-400 font-mono">🏷️ {item.barcode}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {item.category || item.brand
                                                    ? `${item.category || '-'}${item.brand ? ` · ${item.brand}` : ''}`
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{item.warehouseName}</td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                                                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                                                    isOut ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {item.quantity.toLocaleString()} {item.unit}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap tabular-nums">
                                                {item.minStock.toLocaleString()} {item.unit}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                                                +{item.shortage.toLocaleString()} {item.unit}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 py-3 text-right text-xs text-gray-600 whitespace-nowrap tabular-nums">
                                                    {formatCurrency(item.cost || 0)}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {items.map((item, idx) => {
                            const isOut = item.quantity <= 0;
                            const rowNumber = (page - 1) * perPage + idx + 1;
                            return (
                                <div key={item.id} className="p-3.5 space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="text-[11px] text-gray-400 font-mono mr-1.5">#{rowNumber} · {item.code}</span>
                                            {canLinkProduct ? (
                                                <Link href={`/products/${item.productId}`} className="text-sm font-semibold text-gray-800 hover:text-emerald-600 block">
                                                    {item.name}
                                                </Link>
                                            ) : (
                                                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                                            )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold shrink-0 ${
                                            isOut ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            เหลือ {item.quantity.toLocaleString()} {item.unit}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>📦 {item.warehouseName}</span>
                                        <span>ขั้นต่ำ {item.minStock.toLocaleString()} · <strong className="text-emerald-700">เติม +{item.shortage.toLocaleString()}</strong></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <p className="text-xs text-gray-500">
                            แสดง <strong>{startIdx.toLocaleString()}–{endIdx.toLocaleString()}</strong> จากทั้งหมด <strong>{total.toLocaleString()}</strong> รายการ
                        </p>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                >
                                    ← ก่อนหน้า
                                </button>
                                {getPageNumbers().map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`dots-${idx}`} className="px-1.5 text-xs text-gray-400">...</span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPage(p)}
                                            className={`min-w-[30px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                                p === page
                                                    ? 'bg-orange-500 text-white shadow-xs'
                                                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                >
                                    ถัดไป →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
