'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import SortableHeader from '@/components/SortableHeader';
import DeleteButton from '@/components/DeleteButton';
import { deleteProduct, updateProductCategory, updateProductBrand, bulkUpdateProducts } from '@/app/actions/products';
import AlertModal from '@/components/AlertModal';

export interface ProductStockInfo {
    warehouseId: string;
    quantity: number;
    warehouse: { name: string };
}

export interface TableProduct {
    id: string;
    code: string;
    barcode: string | null;
    name: string;
    description: string | null;
    unit: string;
    cost: number | string;
    price: number | string;
    brand: string | null;
    packaging: string | null;
    productGroupId: string | null;
    pointsPerUnit: number;
    minStock: number;
    imageUrl: string | null;
    mfgDate: Date | string | null;
    expDate: Date | string | null;
    isActive: boolean;
    productGroup?: { id: string; name: string } | null;
    productStocks: ProductStockInfo[];
}

export interface ProductGroupOption {
    id: string;
    name: string;
}

interface ProductsTableProps {
    products: TableProduct[];
    productGroups: ProductGroupOption[];
    availableBrands: string[];
    adminUser: boolean;
    warehouseFilter: string;
    groupFilter: string;
    search: string;
    page: number;
    sort: string;
    order: string;
}

export default function ProductsTable({
    products: initialProducts,
    productGroups,
    availableBrands,
    adminUser,
    warehouseFilter,
    groupFilter,
    search,
    page,
    sort,
    order,
}: ProductsTableProps) {
    // Local optimistic state for products
    const [products, setProducts] = useState<TableProduct[]>(initialProducts);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const merged = { page: String(page), search, warehouse: warehouseFilter, group: groupFilter, sort, order, ...params };
        if (merged.search) p.set('search', merged.search);
        if (merged.warehouse) p.set('warehouse', merged.warehouse);
        if (merged.group) p.set('group', merged.group);
        if (merged.sort && merged.sort !== 'createdAt') p.set('sort', merged.sort);
        if (merged.order && merged.order !== 'desc') p.set('order', merged.order);
        if (merged.page !== '1') p.set('page', merged.page);
        return `/products?${p}`;
    };

    // Sync when initialProducts change (e.g. URL page/filter change)
    useEffect(() => {
        setProducts(initialProducts);
        setSelectedIds([]);
    }, [initialProducts]);

    // Active Inline Editing state
    const [activeCategoryPopover, setActiveCategoryPopover] = useState<string | null>(null);
    const [categoryFilterSearch, setCategoryFilterSearch] = useState<string>('');
    const [activeBrandEditor, setActiveBrandEditor] = useState<string | null>(null);
    const [brandInputValue, setBrandInputValue] = useState<string>('');

    // Feedback state (saved checkmark)
    const [savedStatus, setSavedStatus] = useState<Record<string, { type: 'category' | 'brand'; timestamp: number }>>({});

    // Bulk action state
    const [bulkGroupId, setBulkGroupId] = useState<string>('');
    const [bulkBrand, setBulkBrand] = useState<string>('');
    const [bulkSaving, setBulkSaving] = useState<boolean>(false);

    // Alert Modal
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({
        open: false,
        message: '',
        type: 'success',
    });

    const popoverRef = useRef<HTMLDivElement>(null);
    const brandInputRef = useRef<HTMLInputElement>(null);

    // Close popovers on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setActiveCategoryPopover(null);
                setActiveBrandEditor(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when brand editor opens
    useEffect(() => {
        if (activeBrandEditor && brandInputRef.current) {
            brandInputRef.current.focus();
            brandInputRef.current.select();
        }
    }, [activeBrandEditor]);

    // Show temporary saved indicator
    const markSaved = (productId: string, type: 'category' | 'brand') => {
        setSavedStatus(prev => ({
            ...prev,
            [productId]: { type, timestamp: Date.now() },
        }));
        setTimeout(() => {
            setSavedStatus(prev => {
                const next = { ...prev };
                delete next[productId];
                return next;
            });
        }, 2000);
    };

    // Selection Handlers
    const isAllSelected = products.length > 0 && selectedIds.length === products.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < products.length;

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(products.map(p => p.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // --- Inline Category Change ---
    const handleCategorySelect = async (productId: string, newGroupId: string | null) => {
        const targetGroup = productGroups.find(g => g.id === newGroupId);
        const originalProducts = [...products];

        // Optimistic update
        setProducts(prev =>
            prev.map(p => {
                if (p.id !== productId) return p;
                return {
                    ...p,
                    productGroupId: newGroupId,
                    productGroup: targetGroup ? { id: targetGroup.id, name: targetGroup.name } : null,
                };
            })
        );
        setActiveCategoryPopover(null);
        setCategoryFilterSearch('');

        try {
            await updateProductCategory(productId, newGroupId);
            markSaved(productId, 'category');
        } catch (error) {
            // Revert
            setProducts(originalProducts);
            setAlertModal({
                open: true,
                message: (error as Error).message || 'ไม่สามารถเปลี่ยนหมวดหมู่ได้',
                type: 'error',
                title: 'เกิดข้อผิดพลาด',
            });
        }
    };

    // --- Inline Brand Change ---
    const handleBrandSave = async (productId: string, newBrand: string) => {
        const trimmed = newBrand.trim();
        const finalBrand = trimmed || null;
        const originalProducts = [...products];

        // Optimistic update
        setProducts(prev =>
            prev.map(p => {
                if (p.id !== productId) return p;
                return {
                    ...p,
                    brand: finalBrand,
                };
            })
        );
        setActiveBrandEditor(null);

        try {
            await updateProductBrand(productId, finalBrand);
            markSaved(productId, 'brand');
        } catch (error) {
            // Revert
            setProducts(originalProducts);
            setAlertModal({
                open: true,
                message: (error as Error).message || 'ไม่สามารถเปลี่ยนยี่ห้อได้',
                type: 'error',
                title: 'เกิดข้อผิดพลาด',
            });
        }
    };

    // --- Bulk Update Handlers ---
    const handleBulkApply = async () => {
        if (selectedIds.length === 0) return;
        if (!bulkGroupId && !bulkBrand.trim()) {
            setAlertModal({
                open: true,
                message: 'กรุณาเลือกหมวดหมู่ หรือระบุยี่ห้อที่ต้องการเปลี่ยน',
                type: 'error',
                title: 'ยังไม่ได้ระบุข้อมูล',
            });
            return;
        }

        const updates: { productGroupId?: string | null; brand?: string | null } = {};
        let changeSummary = [];

        if (bulkGroupId !== '') {
            if (bulkGroupId === '__NONE__') {
                updates.productGroupId = null;
                changeSummary.push('ล้างหมวดหมู่');
            } else {
                updates.productGroupId = bulkGroupId;
                const groupName = productGroups.find(g => g.id === bulkGroupId)?.name;
                changeSummary.push(`หมวดหมู่เป็น "${groupName}"`);
            }
        }

        if (bulkBrand.trim()) {
            updates.brand = bulkBrand.trim();
            changeSummary.push(`ยี่ห้อเป็น "${bulkBrand.trim()}"`);
        }

        const confirmMsg = `ต้องการเปลี่ยน ${changeSummary.join(' และ ')} ให้สินค้าที่เลือกจำนวน ${selectedIds.length} รายการใช่หรือไม่?`;
        if (!confirm(confirmMsg)) return;

        setBulkSaving(true);
        const originalProducts = [...products];

        // Optimistic update
        setProducts(prev =>
            prev.map(p => {
                if (!selectedIds.includes(p.id)) return p;
                let nextGroup = p.productGroup;
                let nextGroupId = p.productGroupId;
                let nextBrand = p.brand;

                if (updates.productGroupId !== undefined) {
                    nextGroupId = updates.productGroupId;
                    const foundGroup = productGroups.find(g => g.id === updates.productGroupId);
                    nextGroup = foundGroup ? { id: foundGroup.id, name: foundGroup.name } : null;
                }
                if (updates.brand !== undefined) {
                    nextBrand = updates.brand;
                }

                return {
                    ...p,
                    productGroupId: nextGroupId,
                    productGroup: nextGroup,
                    brand: nextBrand,
                };
            })
        );

        try {
            const res = await bulkUpdateProducts(selectedIds, updates);
            setAlertModal({
                open: true,
                message: `อัปเดตข้อมูลสำเร็จจำนวน ${res.count} รายการ`,
                type: 'success',
                title: 'สำเร็จ',
            });
            setSelectedIds([]);
            setBulkGroupId('');
            setBulkBrand('');
        } catch (error) {
            setProducts(originalProducts);
            setAlertModal({
                open: true,
                message: (error as Error).message || 'เกิดข้อผิดพลาดในการอัปเดตแบบกลุ่ม',
                type: 'error',
                title: 'ไม่สำเร็จ',
            });
        } finally {
            setBulkSaving(false);
        }
    };

    // Filtered categories for inline popover
    const filteredPopoverGroups = productGroups.filter(g =>
        g.name.toLowerCase().includes(categoryFilterSearch.toLowerCase().trim())
    );

    return (
        <div className="relative">
            {/* Bulk Action Floating Bar */}
            {selectedIds.length > 0 && (
                <div className="sticky top-4 z-30 mb-4 p-3.5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl shadow-xl border border-emerald-700/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-sm">
                            {selectedIds.length}
                        </span>
                        <div>
                            <span className="font-bold text-sm">
                                เลือกแล้ว {selectedIds.length} รายการ
                            </span>
                            <span className="text-xs text-emerald-200 ml-2 hidden sm:inline">
                                (แก้ไขหมวดหมู่และยี่ห้อยกชุดได้ทันที)
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Change Category Selector */}
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1">
                            <span className="text-xs text-emerald-200">หมวด:</span>
                            <select
                                value={bulkGroupId}
                                onChange={e => setBulkGroupId(e.target.value)}
                                className="bg-transparent text-white text-xs font-medium outline-none cursor-pointer pr-1"
                            >
                                <option value="" className="text-gray-800">
                                    -- ไม่เปลี่ยน --
                                </option>
                                <option value="__NONE__" className="text-rose-600">
                                    ✕ ล้างออก (ไม่ระบุหมวด)
                                </option>
                                {productGroups.map(g => (
                                    <option key={g.id} value={g.id} className="text-gray-800">
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Change Brand Selector / Input */}
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1">
                            <span className="text-xs text-emerald-200">ยี่ห้อ:</span>
                            <input
                                type="text"
                                list="bulk-brands-datalist"
                                value={bulkBrand}
                                onChange={e => setBulkBrand(e.target.value)}
                                placeholder="เลือกหรือพิมพ์ยี่ห้อ..."
                                className="bg-transparent text-white placeholder-emerald-300/60 text-xs font-medium outline-none w-32 sm:w-40"
                            />
                            <datalist id="bulk-brands-datalist">
                                {availableBrands.map(b => (
                                    <option key={b} value={b} />
                                ))}
                            </datalist>
                        </div>

                        {/* Apply Button */}
                        <button
                            type="button"
                            onClick={handleBulkApply}
                            disabled={bulkSaving || (!bulkGroupId && !bulkBrand.trim())}
                            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            {bulkSaving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>กำลังบันทึก...</span>
                                </>
                            ) : (
                                <span>💾 บันทึกที่เลือก</span>
                            )}
                        </button>

                        {/* Cancel Selection */}
                        <button
                            type="button"
                            onClick={() => setSelectedIds([])}
                            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
                            title="ยกเลิกการเลือก"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Datalist for available brands */}
            <datalist id="table-available-brands">
                {availableBrands.map(b => (
                    <option key={b} value={b} />
                ))}
            </datalist>

            {/* Main Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {/* Checkbox column */}
                            <th className="px-3 py-3 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    ref={el => {
                                        if (el) el.indeterminate = isSomeSelected;
                                    }}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    title={isAllSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดในหน้านี้'}
                                />
                            </th>
                            <SortableHeader label="รหัส" field="code" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <SortableHeader label="ชื่อสินค้า" field="name" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                    หมวดหมู่
                                    <span className="text-[10px] text-emerald-600 font-normal lowercase">(คลิกเปลี่ยนได้)</span>
                                </span>
                            </th>
                            <SortableHeader label="ยี่ห้อ" field="brand" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <SortableHeader label="บรรจุภัณฑ์" field="packaging" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            {adminUser && <SortableHeader label="ต้นทุน" field="cost" currentSort={sort} currentOrder={order} buildUrl={buildUrl} align="right" />}
                            <SortableHeader label="ราคาขาย" field="price" currentSort={sort} currentOrder={order} buildUrl={buildUrl} align="right" />
                            <SortableHeader label="หน่วย" field="unit" currentSort={sort} currentOrder={order} buildUrl={buildUrl} />
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {warehouseFilter ? 'Stock คลังที่เลือก' : 'Stock รวม'}
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                                    ไม่พบสินค้า
                                </td>
                            </tr>
                        ) : (
                            products.map(product => {
                                const totalStock = product.productStocks.reduce((s, ps) => s + ps.quantity, 0);
                                const isLowStock = totalStock < product.minStock;
                                const isSelected = selectedIds.includes(product.id);
                                const isCategoryOpen = activeCategoryPopover === product.id;
                                const isBrandOpen = activeBrandEditor === product.id;
                                const savedIndicator = savedStatus[product.id];

                                return (
                                    <tr
                                        key={product.id}
                                        className={`transition-colors ${
                                            isSelected ? 'bg-emerald-50/50' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <td className="px-3 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectOne(product.id)}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        </td>

                                        {/* Code & Barcode */}
                                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                            <Link href={`/products/${product.id}`} className="hover:text-emerald-600 font-medium block">
                                                {product.code}
                                            </Link>
                                            {product.barcode && (
                                                <span className="text-[11px] text-gray-400 block font-mono" title="บาร์โค้ด">
                                                    🏷️ {product.barcode}
                                                </span>
                                            )}
                                        </td>

                                        {/* Name & Details */}
                                        <td className="px-4 py-3">
                                            <Link href={`/products/${product.id}`}>
                                                <p className="text-sm font-medium text-emerald-700 hover:text-emerald-800">{product.name}</p>
                                                {product.description && (
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</p>
                                                )}
                                                {product.expDate && (
                                                    <span
                                                        className={`inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded font-medium ${
                                                            new Date(product.expDate) < new Date()
                                                                ? 'bg-red-50 text-red-600'
                                                                : new Date(product.expDate).getTime() - Date.now() < 30 * 24 * 3600 * 1000
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-gray-100 text-gray-500'
                                                        }`}
                                                    >
                                                        {new Date(product.expDate) < new Date() ? '⚠️ หมดอายุ: ' : '⏳ หมดอายุ: '}
                                                        {new Date(product.expDate).toLocaleDateString('th-TH')}
                                                    </span>
                                                )}
                                            </Link>
                                        </td>

                                        {/* --- Category Column (Inline Click-to-Edit) --- */}
                                        <td className="px-4 py-3 text-sm text-gray-600 relative">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setActiveCategoryPopover(isCategoryOpen ? null : product.id);
                                                        setActiveBrandEditor(null);
                                                        setCategoryFilterSearch('');
                                                    }}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all group ${
                                                        product.productGroup
                                                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
                                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-400 border border-dashed border-gray-300'
                                                    }`}
                                                    title="คลิกเพื่อเปลี่ยนหมวดหมู่"
                                                >
                                                    <span>{product.productGroup?.name || '+ กำหนดหมวด'}</span>
                                                    <span className="text-[10px] text-amber-600/70 group-hover:text-amber-800 font-bold">
                                                        ▾
                                                    </span>
                                                </button>

                                                {/* Saved feedback checkmark */}
                                                {savedIndicator && savedIndicator.type === 'category' && (
                                                    <span className="text-xs text-emerald-600 font-bold animate-bounce">
                                                        ✓
                                                    </span>
                                                )}
                                            </div>

                                            {/* Category Popover Dropdown */}
                                            {isCategoryOpen && (
                                                <div
                                                    ref={popoverRef}
                                                    className="absolute z-50 top-full left-4 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 animate-scale-up"
                                                >
                                                    <div className="px-2.5 py-1 border-b border-gray-100">
                                                        <input
                                                            type="text"
                                                            value={categoryFilterSearch}
                                                            onChange={e => setCategoryFilterSearch(e.target.value)}
                                                            placeholder="🔍 ค้นหาหมวดหมู่..."
                                                            className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-emerald-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto py-1">
                                                        {product.productGroupId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCategorySelect(product.id, null)}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center justify-between"
                                                            >
                                                                <span>✕ ล้างหมวดหมู่</span>
                                                            </button>
                                                        )}
                                                        {filteredPopoverGroups.length === 0 ? (
                                                            <div className="px-3 py-2 text-xs text-gray-400 text-center">
                                                                ไม่พบหมวดหมู่
                                                            </div>
                                                        ) : (
                                                            filteredPopoverGroups.map(g => (
                                                                <button
                                                                    key={g.id}
                                                                    type="button"
                                                                    onClick={() => handleCategorySelect(product.id, g.id)}
                                                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 flex items-center justify-between transition-colors ${
                                                                        product.productGroupId === g.id
                                                                            ? 'font-bold text-amber-800 bg-amber-50/70'
                                                                            : 'text-gray-700'
                                                                    }`}
                                                                >
                                                                    <span>{g.name}</span>
                                                                    {product.productGroupId === g.id && (
                                                                        <span className="text-amber-600 text-xs">✓</span>
                                                                    )}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* --- Brand Column (Inline Click-to-Edit) --- */}
                                        <td className="px-4 py-3 text-sm text-gray-600 relative">
                                            {isBrandOpen ? (
                                                <div ref={popoverRef} className="flex items-center gap-1">
                                                    <input
                                                        ref={brandInputRef}
                                                        type="text"
                                                        list="table-available-brands"
                                                        value={brandInputValue}
                                                        onChange={e => setBrandInputValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleBrandSave(product.id, brandInputValue);
                                                            } else if (e.key === 'Escape') {
                                                                setActiveBrandEditor(null);
                                                            }
                                                        }}
                                                        placeholder="พิมพ์/เลือกยี่ห้อ..."
                                                        className="w-28 sm:w-36 px-2 py-1 text-xs rounded-lg border border-emerald-400 outline-none ring-2 ring-emerald-100 bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBrandSave(product.id, brandInputValue)}
                                                        className="w-6 h-6 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs flex items-center justify-center font-bold"
                                                        title="บันทึก"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveBrandEditor(null)}
                                                        className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs flex items-center justify-center"
                                                        title="ยกเลิก"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setActiveBrandEditor(product.id);
                                                            setActiveCategoryPopover(null);
                                                            setBrandInputValue(product.brand || '');
                                                        }}
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-all group ${
                                                            product.brand
                                                                ? 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                        title="คลิกเพื่อแก้ไขยี่ห้อ"
                                                    >
                                                        <span>{product.brand || '-'}</span>
                                                        <span className="text-[10px] text-gray-300 group-hover:text-emerald-600">
                                                            ✎
                                                        </span>
                                                    </button>

                                                    {/* Saved feedback checkmark */}
                                                    {savedIndicator && savedIndicator.type === 'brand' && (
                                                        <span className="text-xs text-emerald-600 font-bold animate-bounce">
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Packaging */}
                                        <td className="px-4 py-3 text-sm text-gray-600">{product.packaging || <span className="text-gray-300">-</span>}</td>

                                        {/* Cost (Admin Only) */}
                                        {adminUser && <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(Number(product.cost))}</td>}

                                        {/* Price */}
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(product.price))}</td>

                                        {/* Unit */}
                                        <td className="px-4 py-3 text-sm text-gray-600">{product.unit}</td>

                                        {/* Stock */}
                                        <td className="px-4 py-3">
                                            <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                                                {totalStock.toLocaleString()}
                                            </span>
                                            {isLowStock && <span className="ml-1 text-xs text-red-500">⚠️</span>}
                                            {!warehouseFilter && product.productStocks.length > 0 && (
                                                <div className="mt-1">
                                                    {product.productStocks.map(ps => (
                                                        <span key={ps.warehouseId} className="inline-block mr-1 text-[10px] text-gray-400">
                                                            {ps.warehouse.name}: {ps.quantity}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                {product.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-center">
                                            <DeleteButton id={product.id} name={product.name} entityLabel="สินค้า" deleteAction={deleteProduct} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Alert Modal */}
            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}
