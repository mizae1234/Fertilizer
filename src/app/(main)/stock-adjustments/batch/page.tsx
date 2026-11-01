'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBatchStockAdjustment } from '@/app/actions/stock-adjustments';
import AlertModal from '@/components/AlertModal';

interface ProductStock {
    warehouseId: string;
    quantity: number;
}

interface Product {
    id: string;
    code: string;
    barcode?: string | null;
    name: string;
    unit: string;
    brand?: string | null;
    productGroup?: { id: string; name: string } | null;
    productStocks: ProductStock[];
}

interface Warehouse {
    id: string;
    name: string;
    isMain?: boolean;
}

interface ProductGroup {
    id: string;
    name: string;
}

interface RowEdit {
    countedStock: number;
    reason: string;
    customReason?: string;
}

const COMMON_REASONS = [
    'ตรวจนับเกิน',
    'ตรวจนับขาด',
    'ชำรุด',
    'สูญหาย',
    'หมดอายุ',
    'ปรับปรุงยอด',
    'อื่นๆ',
];

export default function BatchStockAdjustmentPage() {
    const router = useRouter();

    // Reference Data
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [brands, setBrands] = useState<string[]>([]);

    // Filters
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [showOnlyModified, setShowOnlyModified] = useState<boolean>(false);
    const [hideZeroStock, setHideZeroStock] = useState<boolean>(false);

    // Products & Edits State
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [edits, setEdits] = useState<Record<string, RowEdit>>({});
    const [batchNote, setBatchNote] = useState<string>('ตรวจนับสต็อกด่วน');

    // UI Modals
    const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [alertModal, setAlertModal] = useState<{
        open: boolean;
        message: string;
        type: 'success' | 'error';
        title?: string;
    }>({ open: false, message: '', type: 'error' });

    // Input refs for keyboard navigation
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // 1. Initial Load of Warehouses, Groups, Brands
    useEffect(() => {
        async function initMetadata() {
            try {
                const [wRes, gRes, bRes] = await Promise.all([
                    fetch('/api/warehouses'),
                    fetch('/api/product-groups'),
                    fetch('/api/products/brands'),
                ]);
                const [wData, gData, bData] = await Promise.all([
                    wRes.json(),
                    gRes.json(),
                    bRes.json(),
                ]);

                if (Array.isArray(wData) && wData.length > 0) {
                    setWarehouses(wData);
                    const mainWh = wData.find(w => w.isMain) || wData[0];
                    setSelectedWarehouseId(mainWh.id);
                }
                if (Array.isArray(gData)) setProductGroups(gData);
                if (Array.isArray(bData)) setBrands(bData);
            } catch (err) {
                console.error('Failed to load initial metadata:', err);
            }
        }
        initMetadata();
    }, []);

    // 2. Fetch Products whenever warehouse, group, or brand changes
    const fetchProducts = async (warehouseId: string, groupId: string, brand: string) => {
        if (!warehouseId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('warehouseId', warehouseId);
            if (groupId) params.set('productGroupId', groupId);
            if (brand) params.set('brand', brand);
            params.set('limit', '1000');

            const res = await fetch(`/api/products?${params.toString()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setProducts(data);
            }
        } catch (err) {
            console.error('Error fetching products:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedWarehouseId) {
            fetchProducts(selectedWarehouseId, selectedGroupId, selectedBrand);
        }
    }, [selectedWarehouseId, selectedGroupId, selectedBrand]);

    // Handle warehouse change with protection against losing unsaved edits
    const handleWarehouseChange = (newWarehouseId: string) => {
        const modifiedCount = Object.keys(edits).length;
        if (modifiedCount > 0) {
            if (!confirm(`คุณมีรายการที่แก้ไขค้างอยู่ ${modifiedCount} รายการ หากเปลี่ยนคลังสินค้า การแก้ไขที่ยังไม่ได้บันทึกจะถูกล้าง ยืนยันเปลี่ยนคลังสินค้าหรือไม่?`)) {
                return;
            }
        }
        setEdits({});
        setSelectedWarehouseId(newWarehouseId);
    };

    // Helper: get current system stock for a product in selected warehouse
    const getCurrentStock = (p: Product): number => {
        const found = p.productStocks?.find(s => s.warehouseId === selectedWarehouseId);
        return found ? found.quantity : 0;
    };

    // Update edit for a single product
    const handleCountChange = (productId: string, valStr: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const currentStock = getCurrentStock(product);
        if (valStr.trim() === '') {
            // Revert / clear edit
            setEdits(prev => {
                const next = { ...prev };
                delete next[productId];
                return next;
            });
            return;
        }

        const countNum = parseInt(valStr, 10);
        if (isNaN(countNum)) return;

        const diff = countNum - currentStock;
        const defaultReason = diff > 0 ? 'ตรวจนับเกิน' : (diff < 0 ? 'ตรวจนับขาด' : 'ปรับปรุงยอด');

        setEdits(prev => ({
            ...prev,
            [productId]: {
                countedStock: countNum,
                reason: prev[productId]?.reason || defaultReason,
                customReason: prev[productId]?.customReason,
            },
        }));
    };

    const handleReasonChange = (productId: string, reason: string) => {
        setEdits(prev => {
            if (!prev[productId]) return prev;
            return {
                ...prev,
                [productId]: {
                    ...prev[productId],
                    reason,
                },
            };
        });
    };

    const handleCustomReasonChange = (productId: string, customReason: string) => {
        setEdits(prev => {
            if (!prev[productId]) return prev;
            return {
                ...prev,
                [productId]: {
                    ...prev[productId],
                    customReason,
                },
            };
        });
    };

    const resetProduct = (productId: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    };

    const setZeroStock = (productId: string) => {
        handleCountChange(productId, '0');
    };

    const adjustStockBy = (productId: string, delta: number) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const currentStock = getCurrentStock(product);
        const existingCount = edits[productId] !== undefined ? edits[productId].countedStock : currentStock;
        handleCountChange(productId, String(existingCount + delta));
    };

    // Filtered Products
    const filteredProducts = useMemo(() => {
        const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);

        return products.filter(p => {
            const currentStock = getCurrentStock(p);
            const isModified = edits[p.id] !== undefined && edits[p.id].countedStock !== currentStock;

            // showOnlyModified filter
            if (showOnlyModified && !isModified) return false;

            // hideZeroStock filter
            if (hideZeroStock && currentStock === 0 && !isModified) return false;

            // search tokens filter
            if (tokens.length > 0) {
                const name = (p.name || '').toLowerCase();
                const code = (p.code || '').toLowerCase();
                const barcode = (p.barcode || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();
                const group = (p.productGroup?.name || '').toLowerCase();

                const matchAll = tokens.every(t => {
                    const padded = /^\d+$/.test(t) ? t.padStart(5, '0') : t;
                    return (
                        name.includes(t) ||
                        code.includes(t) ||
                        code.includes(padded) ||
                        barcode.includes(t) ||
                        brand.includes(t) ||
                        group.includes(t)
                    );
                });
                if (!matchAll) return false;
            }

            return true;
        });
    }, [products, search, showOnlyModified, hideZeroStock, edits, selectedWarehouseId]);

    // Summary of modifications
    const modifiedList = useMemo(() => {
        return products
            .filter(p => {
                const edit = edits[p.id];
                if (!edit) return false;
                const current = getCurrentStock(p);
                return edit.countedStock !== current;
            })
            .map(p => {
                const edit = edits[p.id]!;
                const current = getCurrentStock(p);
                const diff = edit.countedStock - current;
                const finalReason = edit.reason === 'อื่นๆ' && edit.customReason?.trim()
                    ? edit.customReason.trim()
                    : edit.reason;

                return {
                    productId: p.id,
                    code: p.code,
                    name: p.name,
                    unit: p.unit,
                    currentStock: current,
                    countedStock: edit.countedStock,
                    diff,
                    reason: finalReason,
                };
            });
    }, [products, edits, selectedWarehouseId]);

    const modifiedCount = modifiedList.length;
    const totalAdded = modifiedList.filter(m => m.diff > 0).reduce((sum, m) => sum + m.diff, 0);
    const totalDeducted = modifiedList.filter(m => m.diff < 0).reduce((sum, m) => sum + Math.abs(m.diff), 0);

    // Keyboard navigation (Enter / ArrowDown / ArrowUp)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextProduct = filteredProducts[index + 1];
            if (nextProduct && inputRefs.current[nextProduct.id]) {
                inputRefs.current[nextProduct.id]?.focus();
                inputRefs.current[nextProduct.id]?.select();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevProduct = filteredProducts[index - 1];
            if (prevProduct && inputRefs.current[prevProduct.id]) {
                inputRefs.current[prevProduct.id]?.focus();
                inputRefs.current[prevProduct.id]?.select();
            }
        }
    };

    // Save All Edits
    const handleSaveBatch = async () => {
        if (modifiedList.length === 0) {
            setAlertModal({
                open: true,
                message: 'ไม่มีรายการสินค้าที่แก้ไขยอดสต็อก',
                type: 'error',
                title: 'ไม่พบรายการที่เปลี่ยนยอด',
            });
            return;
        }

        setSaving(true);
        try {
            let userId = '';
            try {
                const token = document.cookie.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
                if (token) {
                    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1]), c => c.charCodeAt(0))));
                    userId = payload.userId || '';
                }
            } catch { /* ignore */ }

            const result = await createBatchStockAdjustment({
                warehouseId: selectedWarehouseId,
                note: batchNote.trim() || 'ตรวจนับสต็อกด่วน',
                userId,
                items: modifiedList.map(m => ({
                    productId: m.productId,
                    currentStock: m.currentStock,
                    countedStock: m.countedStock,
                    reason: m.reason,
                })),
            });

            setConfirmModalOpen(false);
            setEdits({});
            setAlertModal({
                open: true,
                message: `บันทึกปรับปรุงสต็อกสำเร็จจำนวน ${result.count} รายการ\nเลขที่เอกสาร: ${result.adjNumber}`,
                type: 'success',
                title: 'บันทึกสำเร็จ',
            });

            // Refresh products with updated stock
            fetchProducts(selectedWarehouseId, selectedGroupId, selectedBrand);
        } catch (error) {
            setAlertModal({
                open: true,
                message: (error as Error).message || 'เกิดข้อผิดพลาดในการบันทึกสต็อก',
                type: 'error',
                title: 'บันทึกไม่สำเร็จ',
            });
        } finally {
            setSaving(false);
        }
    };

    const selectedWarehouseName = warehouses.find(w => w.id === selectedWarehouseId)?.name || 'คลังสินค้า';

    return (
        <div className="animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/stock-adjustments')}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 flex items-center justify-center text-lg shadow-xs transition-colors"
                        title="ย้อนกลับ"
                    >
                        ←
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                                📋 ใบตรวจนับสต็อกด่วน
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                ยกหมวด / ยกคลัง
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            นับสต็อกและปรับปรุงทีละหลายรายการ ข้อมูลเดิมไม่สูญหาย บันทึกเฉพาะแถวที่มีการเปลี่ยนแปลง
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/stock-adjustments"
                        className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 shadow-xs transition-colors"
                    >
                        ประวัติปรับปรุงสต็อก
                    </Link>
                    <Link
                        href="/stock-adjustments/new"
                        className="px-3.5 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
                    >
                        + เพิ่มแบบรายตัว
                    </Link>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Warehouse Selector */}
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            🏭 คลังสินค้าที่ตรวจนับ *
                        </label>
                        <select
                            value={selectedWarehouseId}
                            onChange={e => handleWarehouseChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/40 text-emerald-900"
                        >
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.name} {w.isMain ? '(คลังหลัก)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Category Selector */}
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            📦 หมวดหมู่สินค้า
                        </label>
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">ทั้งหมด ({productGroups.length} หมวดหมู่)</option>
                            {productGroups.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Brand Selector */}
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            🏷️ ยี่ห้อ
                        </label>
                        <select
                            value={selectedBrand}
                            onChange={e => setSelectedBrand(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">ทั้งหมด ({brands.length} ยี่ห้อ)</option>
                            {brands.map(b => (
                                <option key={b} value={b}>
                                    {b}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Real-time Search Input */}
                    <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                            🔍 ค้นหา (ชื่อ / รหัส / บาร์โค้ด)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="พิมพ์เพื่อค้นหาทันที..."
                                className="w-full px-3 py-2 pr-8 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Toggles & Status Summary */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs sm:text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${showOnlyModified
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}>
                            <input
                                type="checkbox"
                                checked={showOnlyModified}
                                onChange={e => setShowOnlyModified(e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>แสดงเฉพาะรายการที่มีการแก้ไข ({modifiedCount})</span>
                        </label>

                        <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${hideZeroStock
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}>
                            <input
                                type="checkbox"
                                checked={hideZeroStock}
                                onChange={e => setHideZeroStock(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>ซ่อนสินค้าที่สต็อกเป็น 0</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500">
                        <span>แสดง <strong>{filteredProducts.length}</strong> จากทั้งหมด {products.length} รายการ</span>
                        {modifiedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                แก้ไขแล้ว {modifiedCount} รายการ
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Instruction Tip */}
            <div className="flex items-center justify-between px-4 py-2.5 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                    <span>💡</span>
                    <span>
                        <strong>เคล็ดลับการตรวจนับด่วน:</strong> พิมพ์ยอดที่นับได้จริงแล้วกด <kbd className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-[11px] font-mono shadow-xs">Enter</kbd> หรือ <kbd className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-[11px] font-mono shadow-xs">↓</kbd> เพื่อข้ามไปยังแถวถัดไปทันที
                    </span>
                </div>
                {modifiedCount > 0 && (
                    <button
                        onClick={() => {
                            if (confirm('คุณต้องการล้างยอดที่แก้ไขทั้งหมดใช่หรือไม่?')) setEdits({});
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium underline ml-2 whitespace-nowrap"
                    >
                        ล้างทั้งหมด ({modifiedCount})
                    </button>
                )}
            </div>

            {/* Product Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-semibold text-xs uppercase">
                                <th className="px-4 py-3.5 w-12 text-center">#</th>
                                <th className="px-4 py-3.5 w-36">รหัส / บาร์โค้ด</th>
                                <th className="px-4 py-3.5 min-w-[200px]">ชื่อสินค้า</th>
                                <th className="px-4 py-3.5 w-24">หน่วย</th>
                                <th className="px-4 py-3.5 w-28 text-right">สต็อกระบบ</th>
                                <th className="px-4 py-3.5 w-56 text-center">สต็อกที่นับได้จริง</th>
                                <th className="px-4 py-3.5 w-28 text-center">ผลต่าง (+/-)</th>
                                <th className="px-4 py-3.5 min-w-[180px]">เหตุผล</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-gray-400">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mb-2"></div>
                                        <p>กำลังโหลดรายการสินค้าในคลัง...</p>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-gray-400">
                                        <p className="text-base font-medium">ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข</p>
                                        <p className="text-xs text-gray-400 mt-1">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p, idx) => {
                                    const currentStock = getCurrentStock(p);
                                    const edit = edits[p.id];
                                    const isEdited = edit !== undefined && edit.countedStock !== currentStock;
                                    const countedValue = edit !== undefined ? String(edit.countedStock) : '';
                                    const diff = isEdited ? edit.countedStock - currentStock : 0;

                                    return (
                                        <tr
                                            key={p.id}
                                            className={`transition-colors ${isEdited
                                                ? diff > 0
                                                    ? 'bg-emerald-50/60 hover:bg-emerald-50'
                                                    : 'bg-rose-50/60 hover:bg-rose-50'
                                                : 'hover:bg-gray-50/70'
                                                }`}
                                        >
                                            {/* # */}
                                            <td className="px-4 py-3 text-center text-xs text-gray-400 font-mono">
                                                {idx + 1}
                                            </td>

                                            {/* Code & Barcode */}
                                            <td className="px-4 py-3">
                                                <div className="font-mono text-xs font-semibold text-gray-700">
                                                    {p.code}
                                                </div>
                                                {p.barcode && (
                                                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                        {p.barcode}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Product Name, Group & Brand */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900 leading-snug">
                                                    {p.name}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    {p.productGroup && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600">
                                                            {p.productGroup.name}
                                                        </span>
                                                    )}
                                                    {p.brand && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                            {p.brand}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Unit */}
                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                {p.unit}
                                            </td>

                                            {/* Current Stock */}
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${currentStock > 0
                                                    ? 'bg-gray-100 text-gray-800'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {currentStock.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Counted Input */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <input
                                                        ref={el => { inputRefs.current[p.id] = el; }}
                                                        type="number"
                                                        value={countedValue}
                                                        placeholder={String(currentStock)}
                                                        onChange={e => handleCountChange(p.id, e.target.value)}
                                                        onKeyDown={e => handleKeyDown(e, idx)}
                                                        className={`w-24 px-2.5 py-1.5 rounded-xl border text-center font-bold text-sm outline-none transition-all ${isEdited
                                                            ? diff > 0
                                                                ? 'border-emerald-400 bg-white text-emerald-700 ring-2 ring-emerald-200'
                                                                : 'border-rose-400 bg-white text-rose-700 ring-2 ring-rose-200'
                                                            : 'border-gray-200 bg-gray-50/50 text-gray-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                                                            }`}
                                                    />

                                                    {/* Quick Helper Buttons */}
                                                    <div className="flex items-center gap-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustStockBy(p.id, -1)}
                                                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center transition-colors"
                                                            title="ลด 1"
                                                        >
                                                            -1
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustStockBy(p.id, 1)}
                                                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs flex items-center justify-center transition-colors"
                                                            title="เพิ่ม 1"
                                                        >
                                                            +1
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setZeroStock(p.id)}
                                                            className="px-1.5 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[10px] font-mono flex items-center justify-center transition-colors"
                                                            title="ปรับเป็น 0 (สินค้าหมด)"
                                                        >
                                                            =0
                                                        </button>
                                                        {isEdited && (
                                                            <button
                                                                type="button"
                                                                onClick={() => resetProduct(p.id)}
                                                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs flex items-center justify-center transition-colors"
                                                                title="คืนค่ายอดเดิม"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Diff Badge */}
                                            <td className="px-4 py-3 text-center">
                                                {isEdited ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${diff > 0
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                        {diff > 0 ? `+${diff}` : diff}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">-</span>
                                                )}
                                            </td>

                                            {/* Reason Dropdown & Custom Text */}
                                            <td className="px-4 py-3">
                                                {isEdited ? (
                                                    <div className="space-y-1">
                                                        <select
                                                            value={COMMON_REASONS.includes(edit.reason) ? edit.reason : 'อื่นๆ'}
                                                            onChange={e => handleReasonChange(p.id, e.target.value)}
                                                            className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                                                        >
                                                            {COMMON_REASONS.map(r => (
                                                                <option key={r} value={r}>
                                                                    {r}
                                                                </option>
                            ))}
                                                        </select>
                                                        {(edit.reason === 'อื่นๆ' || !COMMON_REASONS.includes(edit.reason)) && (
                                                            <input
                                                                type="text"
                                                                placeholder="ระบุเหตุผล..."
                                                                value={edit.customReason || ''}
                                                                onChange={e => handleCustomReasonChange(p.id, e.target.value)}
                                                                className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-xl py-3 px-4 sm:px-8 transition-transform duration-300 ${modifiedCount > 0 ? 'translate-y-0' : 'translate-y-full'
                }`}>
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                            {modifiedCount}
                        </span>
                        <div>
                            <span className="font-bold text-gray-800">
                                คลัง: {selectedWarehouseName}
                            </span>
                            <span className="text-gray-500 ml-2">
                                (แก้ไข {modifiedCount} รายการ:
                                {totalAdded > 0 && <span className="text-emerald-600 font-semibold ml-1">+{totalAdded} ชิ้น</span>}
                                {totalAdded > 0 && totalDeducted > 0 && <span>, </span>}
                                {totalDeducted > 0 && <span className="text-rose-600 font-semibold ml-1">-{totalDeducted} ชิ้น</span>}
                                )
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('คุณต้องการยกเลิกการแก้ไขทั้งหมดและล้างค่าใช่หรือไม่?')) {
                                    setEdits({});
                                }
                            }}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs sm:text-sm font-medium transition-colors"
                        >
                            ✕ ล้างทั้งหมด
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmModalOpen(true)}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs sm:text-sm hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all"
                        >
                            <span>💾 บันทึกปรับปรุงสต็อก ({modifiedCount} รายการ)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">
                                    ยืนยันการบันทึกปรับปรุงสต็อก
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    คลัง: <strong>{selectedWarehouseName}</strong> · ปรับปรุงทั้งหมด {modifiedCount} รายการ
                                </p>
                            </div>
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2">
                                <span className="text-base leading-none">🛡️</span>
                                <div>
                                    <strong>ความปลอดภัยของข้อมูล:</strong> ระบบจะบันทึกและปรับปรุงเฉพาะ <strong>{modifiedCount}</strong> รายการนี้เท่านั้น รายการสินค้าอื่นๆ ที่ไม่ได้กรอกจะคงเดิม 100% ไม่สูญหาย พร้อมบันทึกประวัติการตรวจนับอย่างสมบูรณ์
                                </div>
                            </div>

                            {/* Batch Note */}
                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                                    หมายเหตุบันทึกทั้งใบ (Batch Note)
                                </label>
                                <input
                                    type="text"
                                    value={batchNote}
                                    onChange={e => setBatchNote(e.target.value)}
                                    placeholder="เช่น ตรวจนับสต็อกประจำสัปดาห์, ปรับปรุงสต็อกโซน A..."
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            {/* Changed Items List */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-2 block">
                                    รายการสินค้าที่จะถูกปรับปรุง:
                                </label>
                                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-100 text-gray-500 font-semibold">
                                            <tr>
                                                <th className="px-3 py-2">รหัส / ชื่อสินค้า</th>
                                                <th className="px-3 py-2 text-right">เดิม</th>
                                                <th className="px-3 py-2 text-right">นับได้</th>
                                                <th className="px-3 py-2 text-center">ผลต่าง</th>
                                                <th className="px-3 py-2">เหตุผล</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {modifiedList.map(item => (
                                                <tr key={item.productId} className="hover:bg-gray-50/50">
                                                    <td className="px-3 py-2">
                                                        <div className="font-mono text-[11px] text-gray-400">{item.code}</div>
                                                        <div className="font-medium text-gray-800">{item.name}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-gray-600">
                                                        {item.currentStock} {item.unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                                                        {item.countedStock} {item.unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${item.diff > 0
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                            {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">
                                                        {item.reason}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmModalOpen(false)}
                                disabled={saving}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveBatch}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>กำลังบันทึก...</span>
                                    </>
                                ) : (
                                    <span>ยืนยันบันทึกสต็อก</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert / Success Modal */}
            <AlertModal
                open={alertModal.open}
                onClose={() => {
                    setAlertModal(prev => ({ ...prev, open: false }));
                    if (alertModal.type === 'success') {
                        // Keep on page to continue stock counting, or user can click back
                    }
                }}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}
