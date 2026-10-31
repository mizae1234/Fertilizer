'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BarcodeSvg from '@/components/BarcodeSvg';
import { formatCurrency } from '@/lib/utils';

interface ProductItem {
    id: string;
    code: string;
    barcode?: string | null;
    name: string;
    price: number | string;
    unit: string;
    brand?: string | null;
    productGroup?: { name: string } | null;
}

type LabelPreset = 'thermal-50x30' | 'thermal-40x30' | 'thermal-30x20' | 'a4-3x10' | 'a4-4x10';

interface LabelConfig {
    preset: LabelPreset;
    showShopName: boolean;
    shopName: string;
    showProductName: boolean;
    showPrice: boolean;
    showCode: boolean;
}

const PRESET_OPTIONS: { id: LabelPreset; name: string; type: 'thermal' | 'a4'; desc: string; widthMm: number; heightMm: number }[] = [
    { id: 'thermal-50x30', name: '50 x 30 มม. (ม้วนสติ๊กเกอร์)', type: 'thermal', desc: 'ขนาดยอดนิยม รายละเอียดครบ ตัวหนังสือชัด', widthMm: 50, heightMm: 30 },
    { id: 'thermal-40x30', name: '40 x 30 มม. (ม้วนสติ๊กเกอร์)', type: 'thermal', desc: 'ขนาดกะทัดรัด สำหรับซอง/ขวดขนาดกลาง', widthMm: 40, heightMm: 30 },
    { id: 'thermal-30x20', name: '30 x 20 มม. (ม้วนสติ๊กเกอร์)', type: 'thermal', desc: 'ขนาดเล็ก สำหรับสินค้าชิ้นเล็ก', widthMm: 30, heightMm: 20 },
    { id: 'a4-3x10', name: 'กระดาษ A4 ตาราง 3 x 10 (30 ใบ)', type: 'a4', desc: 'สติ๊กเกอร์ A4 สำเร็จรูป 30 ใบ/แผ่น', widthMm: 64, heightMm: 28 },
    { id: 'a4-4x10', name: 'กระดาษ A4 ตาราง 4 x 10 (40 ใบ)', type: 'a4', desc: 'สติ๊กเกอร์ A4 สำเร็จรูป 40 ใบ/แผ่น', widthMm: 48, heightMm: 28 },
];

function BarcodeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialProductId = searchParams.get('productId');

    const [products, setProducts] = useState<ProductItem[]>([]);
    const [groups, setGroups] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

    // Selected products for printing: Map productId -> quantity
    const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});
    const [batchQty, setBatchQty] = useState<number>(10);

    // Configuration
    const [config, setConfig] = useState<LabelConfig>({
        preset: 'thermal-50x30',
        showShopName: false,
        shopName: '',
        showProductName: true,
        showPrice: true,
        showCode: true,
    });

    // Fetch shop info and products
    useEffect(() => {
        async function init() {
            setLoading(true);
            try {
                const [prodRes, shopRes] = await Promise.all([
                    fetch('/api/products').then(r => r.json()),
                    fetch('/api/shop-info').then(r => r.json()).catch(() => null),
                ]);

                if (Array.isArray(prodRes)) {
                    setProducts(prodRes);
                    const uniqueGroups = Array.from(new Set(prodRes.map((p: any) => p.productGroup?.name).filter(Boolean))) as string[];
                    setGroups(uniqueGroups);

                    if (initialProductId) {
                        const target = prodRes.find((p: any) => p.id === initialProductId);
                        if (target) {
                            setPrintQuantities({ [target.id]: 10 });
                        }
                    }
                }

                if (shopRes && shopRes.name) {
                    setConfig(prev => ({ ...prev, shopName: shopRes.name }));
                }
            } catch (err) {
                console.error('Failed to load barcode products:', err);
            }
            setLoading(false);
        }
        init();
    }, [initialProductId]);

    // Filtered products list
    const filteredProducts = useMemo(() => {
        const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
        return products.filter(p => {
            const matchesGroup = selectedGroup === 'ALL' || p.productGroup?.name === selectedGroup;
            if (!matchesGroup) return false;
            if (tokens.length === 0) return true;
            const name = (p.name || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase();
            const brand = (p.brand || '').toLowerCase();
            return tokens.every(t => {
                const padded = /^\d+$/.test(t) ? t.padStart(5, '0') : t;
                return name.includes(t) || code.includes(t) || code.includes(padded) || barcode.includes(t) || brand.includes(t);
            });
        });
    }, [products, searchTerm, selectedGroup]);

    // Selected items summary
    const selectedList = useMemo(() => {
        return products
            .filter(p => (printQuantities[p.id] || 0) > 0)
            .map(p => ({
                product: p,
                quantity: printQuantities[p.id] || 0,
            }));
    }, [products, printQuantities]);

    const totalLabelsCount = useMemo(() => {
        return Object.values(printQuantities).reduce((sum, qty) => sum + qty, 0);
    }, [printQuantities]);

    // Toggle product selection
    const toggleProduct = (productId: string, defaultCount = 10) => {
        setPrintQuantities(prev => {
            const next = { ...prev };
            if (next[productId]) {
                delete next[productId];
            } else {
                next[productId] = defaultCount;
            }
            return next;
        });
    };

    const updateQuantity = (productId: string, qty: number) => {
        setPrintQuantities(prev => {
            const next = { ...prev };
            if (qty <= 0) {
                delete next[productId];
            } else {
                next[productId] = qty;
            }
            return next;
        });
    };

    const selectAllFiltered = () => {
        setPrintQuantities(prev => {
            const next = { ...prev };
            filteredProducts.forEach(p => {
                if (!next[p.id]) next[p.id] = batchQty;
            });
            return next;
        });
    };

    const clearAllSelection = () => {
        setPrintQuantities({});
    };

    const applyBatchQty = () => {
        setPrintQuantities(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                next[id] = batchQty;
            });
            return next;
        });
    };

    // Print Handler
    const handlePrint = () => {
        window.print();
    };

    // Flatten labels for printing
    const flattenedLabels = useMemo(() => {
        const list: ProductItem[] = [];
        selectedList.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                list.push(item.product);
            }
        });
        return list;
    }, [selectedList]);

    const activePreset = PRESET_OPTIONS.find(p => p.id === config.preset) || PRESET_OPTIONS[0];

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header (Hidden on Print) */}
            <div className="no-print flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/products" className="text-gray-400 hover:text-gray-600 text-sm">
                            ← กลับรายการสินค้า
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mt-1 flex items-center gap-2">
                        🏷️ พิมพ์บาร์โค้ดสินค้า (Barcode Generator)
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        สร้างและพิมพ์สติ๊กเกอร์บาร์โค้ด Code 128 รองรับทั้งเครื่องพิมพ์สติ๊กเกอร์ความร้อนและกระดาษ A4
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        disabled={flattenedLabels.length === 0}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all ${
                            flattenedLabels.length > 0
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200 cursor-pointer scale-100 hover:scale-[1.02]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        <span>🖨️ สั่งพิมพ์สติ๊กเกอร์ ({totalLabelsCount} ใบ)</span>
                    </button>
                </div>
            </div>

            {/* Main Interactive Grid (Hidden on Print) */}
            <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Product Selection (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <span>1. ค้นหาและเลือกสินค้า</span>
                                <span className="text-xs font-normal text-gray-400">
                                    (เลือกแล้ว {selectedList.length} รายการ / {totalLabelsCount} ใบ)
                                </span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={selectAllFiltered}
                                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                                >
                                    + เลือกทั้งหมดในหน้านี้
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={clearAllSelection}
                                    className="text-xs font-medium text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                                >
                                    ล้างทั้งหมด
                                </button>
                            </div>
                        </div>

                        {/* Search & Filter Controls */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="🔍 ค้นหาชื่อสินค้า หรือ รหัสสินค้า..."
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {groups.length > 0 && (
                                <select
                                    value={selectedGroup}
                                    onChange={e => setSelectedGroup(e.target.value)}
                                    className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="ALL">📁 ทุกหมวดหมู่</option>
                                    {groups.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Batch Quantity Adjuster */}
                        <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-2.5 px-3">
                            <span className="text-xs text-emerald-800 font-medium">ตั้งจำนวนพิมพ์เริ่มต้น:</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={batchQty}
                                    onChange={e => setBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold rounded-lg border border-emerald-300 bg-white"
                                />
                                <span className="text-xs text-emerald-700">ใบ</span>
                                {selectedList.length > 0 && (
                                    <button
                                        onClick={applyBatchQty}
                                        className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                                    >
                                        ปรับใช้กับที่เลือกทั้งหมด
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Products List Table */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-xs text-gray-400">กำลังโหลดรายการสินค้า...</div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="p-8 text-center text-xs text-gray-400">ไม่พบสินค้าที่ตรงกับการค้นหา</div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                                        <tr className="text-gray-500 font-semibold">
                                            <th className="py-2.5 px-3 text-left w-10">เลือก</th>
                                            <th className="py-2.5 px-2 text-left">รหัส</th>
                                            <th className="py-2.5 px-3 text-left">ชื่อสินค้า</th>
                                            <th className="py-2.5 px-3 text-right">ราคา</th>
                                            <th className="py-2.5 px-3 text-center w-28">จำนวนพิมพ์ (ใบ)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredProducts.map(p => {
                                            const qty = printQuantities[p.id] || 0;
                                            const isSelected = qty > 0;
                                            return (
                                                <tr
                                                    key={p.id}
                                                    onClick={() => toggleProduct(p.id, batchQty)}
                                                    className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                                                        isSelected ? 'bg-emerald-50/70' : ''
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleProduct(p.id, batchQty)}
                                                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 font-mono text-gray-600 font-medium whitespace-nowrap">
                                                        <div>{p.code}</div>
                                                        {p.barcode && <div className="text-[10px] text-gray-400">🏷️ {p.barcode}</div>}
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-800 font-medium">
                                                        <div className="truncate max-w-[220px]" title={p.name}>
                                                            {p.name}
                                                        </div>
                                                        {p.productGroup && (
                                                            <span className="text-[10px] text-gray-400">
                                                                {p.productGroup.name}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-gray-700 whitespace-nowrap">
                                                        {formatCurrency(Number(p.price))}
                                                    </td>
                                                    <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                        {isSelected ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => updateQuantity(p.id, qty - 1)}
                                                                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={qty}
                                                                    onChange={e => updateQuantity(p.id, parseInt(e.target.value) || 0)}
                                                                    className="w-12 py-0.5 text-center font-bold border border-gray-200 rounded text-xs"
                                                                />
                                                                <button
                                                                    onClick={() => updateQuantity(p.id, qty + 1)}
                                                                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => toggleProduct(p.id, batchQty)}
                                                                className="px-2.5 py-1 text-[11px] rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                                                            >
                                                                + เลือก
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings & Live Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Settings Panel */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                            <span>⚙️ 2. ตั้งค่าขนาดและรูปแบบสติ๊กเกอร์</span>
                        </h2>

                        {/* Preset Dropdown */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">ขนาดสติ๊กเกอร์ / กระดาษ:</label>
                            <select
                                value={config.preset}
                                onChange={e => setConfig(prev => ({ ...prev, preset: e.target.value as LabelPreset }))}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                            >
                                {PRESET_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-400 italic">
                                {activePreset.desc} ({activePreset.widthMm} × {activePreset.heightMm} มม.)
                            </p>
                        </div>

                        {/* Content Checkboxes */}
                        <div className="space-y-2 pt-1 border-t border-gray-100">
                            <label className="text-xs font-semibold text-gray-700 block">ข้อมูลบนสติ๊กเกอร์:</label>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.showProductName}
                                        onChange={e => setConfig(prev => ({ ...prev, showProductName: e.target.checked }))}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>ชื่อสินค้า</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.showPrice}
                                        onChange={e => setConfig(prev => ({ ...prev, showPrice: e.target.checked }))}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>ราคาขาย</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.showCode}
                                        onChange={e => setConfig(prev => ({ ...prev, showCode: e.target.checked }))}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>รหัสสินค้าใต้แท่ง</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.showShopName}
                                        onChange={e => setConfig(prev => ({ ...prev, showShopName: e.target.checked }))}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>ชื่อร้านค้า</span>
                                </label>
                            </div>

                            {config.showShopName && (
                                <div className="pt-2">
                                    <input
                                        type="text"
                                        value={config.shopName}
                                        onChange={e => setConfig(prev => ({ ...prev, shopName: e.target.value }))}
                                        placeholder="พิมพ์ชื่อร้านที่ต้องการให้ปรากฏบนสติ๊กเกอร์..."
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live Preview Box */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <span>👁️ ตัวอย่างสติ๊กเกอร์จริง (Live Preview)</span>
                            </h2>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                {activePreset.widthMm}×{activePreset.heightMm} mm
                            </span>
                        </div>

                        {selectedList.length === 0 ? (
                            <div className="py-12 px-4 text-center border-2 border-dashed border-gray-200 rounded-xl">
                                <p className="text-2xl">🏷️</p>
                                <p className="text-xs text-gray-500 mt-2 font-medium">ยังไม่ได้เลือกสินค้า</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    ติ๊กเลือกสินค้าจากตารางด้านซ้ายเพื่อดูตัวอย่างสติ๊กเกอร์
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden">
                                <p className="text-[10px] text-slate-400 mb-2">
                                    ตัวอย่างสติ๊กเกอร์ ({selectedList[0].product.name})
                                </p>
                                {/* Simulated Physical Sticker */}
                                <div
                                    className="bg-white text-black shadow-md border border-gray-300 rounded flex flex-col items-center justify-between p-2 text-center"
                                    style={{
                                        width: `${activePreset.widthMm * 3.78}px`,
                                        height: `${activePreset.heightMm * 3.78}px`,
                                        maxWidth: '100%',
                                    }}
                                >
                                    {config.showShopName && (
                                        <p className="text-[9px] font-bold text-gray-600 truncate w-full uppercase tracking-tight">
                                            {config.shopName || 'ชื่อร้านค้า'}
                                        </p>
                                    )}

                                    {config.showProductName && (
                                        <p className="text-[10px] font-bold text-gray-900 leading-tight line-clamp-2 w-full px-1">
                                            {selectedList[0].product.name}
                                        </p>
                                    )}

                                    <div className="my-auto flex flex-col items-center justify-center w-full">
                                        <BarcodeSvg
                                            value={selectedList[0].product.barcode || selectedList[0].product.code}
                                            width={activePreset.heightMm <= 20 ? 1.0 : 1.3}
                                            height={activePreset.heightMm <= 20 ? 18 : 26}
                                            fontSize={config.showCode ? 9 : 0}
                                            displayValue={config.showCode}
                                        />
                                    </div>

                                    {config.showPrice && (
                                        <p className="text-[11px] font-extrabold text-gray-950 mt-0.5">
                                            {formatCurrency(Number(selectedList[0].product.price))}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 text-center">
                                    <button
                                        onClick={handlePrint}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer"
                                    >
                                        🖨️ สั่งพิมพ์ทั้งหมด ({totalLabelsCount} ใบ)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ==================== PRINT AREA (VISIBLE ONLY WHEN PRINTING) ==================== */}
            <div className="print-area hidden">
                {activePreset.type === 'thermal' ? (
                    // Thermal Roll: Each label is an individual page
                    <div className="thermal-print-container">
                        {flattenedLabels.map((prod, idx) => (
                            <div
                                key={idx}
                                className="thermal-label-item"
                                style={{
                                    width: `${activePreset.widthMm}mm`,
                                    height: `${activePreset.heightMm}mm`,
                                }}
                            >
                                {config.showShopName && (
                                    <div className="label-shop-name text-[8pt] font-bold text-center truncate w-full leading-none mb-0.5">
                                        {config.shopName}
                                    </div>
                                )}
                                {config.showProductName && (
                                    <div className="label-product-name text-[9pt] font-bold text-center leading-tight line-clamp-2 w-full px-1">
                                        {prod.name}
                                    </div>
                                )}
                                <div className="label-barcode-svg flex justify-center my-0.5 w-full">
                                    <BarcodeSvg
                                        value={prod.barcode || prod.code}
                                        width={activePreset.heightMm <= 20 ? 1.0 : 1.35}
                                        height={activePreset.heightMm <= 20 ? 18 : 26}
                                        fontSize={config.showCode ? 9 : 0}
                                        displayValue={config.showCode}
                                    />
                                </div>
                                {config.showPrice && (
                                    <div className="label-price text-[10pt] font-black text-center leading-none mt-0.5">
                                        {formatCurrency(Number(prod.price))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // A4 Sheet: Grid layout
                    <div
                        className={
                            activePreset.id === 'a4-3x10'
                                ? 'a4-grid a4-grid-3x10'
                                : 'a4-grid a4-grid-4x10'
                        }
                    >
                        {flattenedLabels.map((prod, idx) => (
                            <div key={idx} className="a4-label-item">
                                {config.showShopName && (
                                    <div className="text-[7pt] font-semibold text-center truncate w-full leading-none">
                                        {config.shopName}
                                    </div>
                                )}
                                {config.showProductName && (
                                    <div className="text-[8pt] font-bold text-center leading-tight line-clamp-1 w-full px-1">
                                        {prod.name}
                                    </div>
                                )}
                                <div className="flex justify-center my-0.5">
                                    <BarcodeSvg
                                        value={prod.barcode || prod.code}
                                        width={1.1}
                                        height={20}
                                        fontSize={config.showCode ? 8 : 0}
                                        displayValue={config.showCode}
                                    />
                                </div>
                                {config.showPrice && (
                                    <div className="text-[9pt] font-extrabold text-center leading-none">
                                        {formatCurrency(Number(prod.price))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Print CSS Styles injected dynamically */}
            <style jsx global>{`
                @media print {
                    /* Hide EVERYTHING outside the print area */
                    body * {
                        visibility: hidden;
                    }
                    .no-print,
                    header,
                    nav,
                    aside,
                    footer {
                        display: none !important;
                    }
                    .print-area,
                    .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        display: block !important;
                    }

                    /* Thermal Printer Page Size */
                    ${activePreset.type === 'thermal'
                        ? `
                        @page {
                            size: ${activePreset.widthMm}mm ${activePreset.heightMm}mm;
                            margin: 0;
                        }
                        .thermal-print-container {
                            width: ${activePreset.widthMm}mm;
                            margin: 0;
                            padding: 0;
                        }
                        .thermal-label-item {
                            width: ${activePreset.widthMm}mm;
                            height: ${activePreset.heightMm}mm;
                            box-sizing: border-box;
                            padding: 1.5mm 1.5mm;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            page-break-after: always;
                            break-after: page;
                            overflow: hidden;
                            background: #ffffff;
                            color: #000000;
                        }
                    `
                        : `
                        @page {
                            size: A4 portrait;
                            margin: 8mm 6mm;
                        }
                        .a4-grid {
                            display: grid !important;
                            gap: 2mm 3mm;
                            width: 100%;
                        }
                        .a4-grid-3x10 {
                            grid-template-columns: repeat(3, 1fr) !important;
                        }
                        .a4-grid-4x10 {
                            grid-template-columns: repeat(4, 1fr) !important;
                        }
                        .a4-label-item {
                            height: 27mm;
                            box-sizing: border-box;
                            padding: 1mm 1.5mm;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                            border: 1px dashed #d1d5db;
                            page-break-inside: avoid;
                            break-inside: avoid;
                            background: #ffffff;
                            color: #000000;
                        }
                    `}
                }
            `}</style>
        </div>
    );
}

export default function BarcodePrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
            <BarcodeContent />
        </Suspense>
    );
}
