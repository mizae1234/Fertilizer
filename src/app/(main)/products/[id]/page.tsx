'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { updateProductCost } from '@/app/actions/products';
import { formatCurrency, formatDate } from '@/lib/utils';
import AlertModal from '@/components/AlertModal';

interface ProductStock {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    avgCost: number | string;
    lastCost: number | string;
    warehouse: { id: string; name: string };
}

interface StockTransaction {
    id: string;
    type: string;
    quantity: number;
    unitCost: number | string;
    reference: string | null;
    notes: string | null;
    createdAt: string;
    warehouse: { name: string };
}

interface ProductPrice {
    id: string;
    price: number | string;
    customerGroupId: string;
    customerGroup: { name: string };
}

interface ProductUnit {
    id: string;
    unitName: string;
    conversionRate: number | string;
    sellingPrice: number | string;
    isBaseUnit: boolean;
}

interface ProductDetail {
    id: string;
    code: string;
    name: string;
    description: string | null;
    unit: string;
    cost: number | string;
    price: number | string;
    brand: string | null;
    packaging: string | null;
    productGroup: { name: string } | null;
    pointsPerUnit: number;
    minStock: number;
    isActive: boolean;
    createdAt: string;
    productStocks: ProductStock[];
    productPrices: ProductPrice[];
    productUnits: ProductUnit[];
    stockTransactions: StockTransaction[];
}

const txTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
    GOODS_RECEIVE: { label: 'รับสินค้า', color: 'text-emerald-700 bg-emerald-50', icon: '📥' },
    SALE: { label: 'ขาย', color: 'text-blue-700 bg-blue-50', icon: '💰' },
    TRANSFER_IN: { label: 'โอนเข้า', color: 'text-purple-700 bg-purple-50', icon: '⬅️' },
    TRANSFER_OUT: { label: 'โอนออก', color: 'text-orange-700 bg-orange-50', icon: '➡️' },
    ADJUSTMENT: { label: 'ปรับ', color: 'text-gray-700 bg-gray-50', icon: '🔧' },
};

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'stock' | 'log'>('stock');

    // Cost editing (product-level)
    const [editingCost, setEditingCost] = useState(false);
    const [costType, setCostType] = useState<'avg' | 'last' | 'custom'>('avg');
    const [customCost, setCustomCost] = useState(0);
    const [savingCost, setSavingCost] = useState(false);

    // Points editing
    const [editingPoints, setEditingPoints] = useState(false);
    const [pointsValue, setPointsValue] = useState(0);
    const [savingPoints, setSavingPoints] = useState(false);

    // Price editing
    const [editingSellingPrice, setEditingSellingPrice] = useState(false);
    const [sellingPriceValue, setSellingPriceValue] = useState(0);
    const [savingSellingPrice, setSavingSellingPrice] = useState(false);


    // Inline editing
    const [savingId, setSavingId] = useState<string | null>(null);
    const [customerGroups, setCustomerGroups] = useState<{ id: string; name: string }[]>([]);
    // Temp rows for adding new items (not yet saved)
    const [newPriceRows, setNewPriceRows] = useState<{ customerGroupId: string; price: number }[]>([]);
    const [newUnitRows, setNewUnitRows] = useState<{ unitName: string; conversionRate: number; sellingPrice: number; isBaseUnit: boolean }[]>([]);

    // Alert modal
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });
    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then(r => r.json())
            .then(data => { setProduct(data); setLoading(false); });
        fetch('/api/customer-groups')
            .then(r => r.json())
            .then(data => setCustomerGroups(data));
    }, [id]);

    // Compute global avg / last costs from all warehouses
    const globalAvgCost = product ? (() => {
        const stocks = product.productStocks;
        const totalQty = stocks.reduce((s, st) => s + st.quantity, 0);
        return totalQty > 0
            ? Math.round(stocks.reduce((s, st) => s + Number(st.avgCost) * st.quantity, 0) / totalQty * 100) / 100
            : stocks.length > 0 ? Number(stocks[0].avgCost) : 0;
    })() : 0;
    const globalLastCost = product
        ? (product.productStocks.length > 0 ? Math.max(...product.productStocks.map(st => Number(st.lastCost))) : 0)
        : 0;

    const handleSaveCost = async () => {
        if (!product) return;
        setSavingCost(true);
        try {
            await updateProductCost(product.id, costType, costType === 'custom' ? customCost : undefined);
            showAlert('บันทึกต้นทุนเรียบร้อย', 'success', 'สำเร็จ');
            const data = await fetch(`/api/products/${id}`).then(r => r.json());
            setProduct(data);
            setEditingCost(false);
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingCost(false);
        }
    };

    const startEditingCost = () => {
        setEditingCost(true);
        setCostType('avg');
        setCustomCost(Number(product?.cost || 0));
    };

    const refreshProduct = async () => {
        const data = await fetch(`/api/products/${id}`).then(r => r.json());
        setProduct(data);
    };

    const handleSavePoints = async () => {
        setSavingPoints(true);
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pointsPerUnit: pointsValue }),
            });
            if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
            showAlert('บันทึกแต้มเรียบร้อย', 'success', 'สำเร็จ');
            setEditingPoints(false);
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingPoints(false);
        }
    };

    const handleSaveSellingPrice = async () => {
        setSavingSellingPrice(true);
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: sellingPriceValue }),
            });
            if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
            showAlert('บันทึกราคาขายเรียบร้อย', 'success', 'สำเร็จ');
            setEditingSellingPrice(false);
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingSellingPrice(false);
        }
    };


    // Price inline CRUD
    const handleSaveExistingPrice = async (pp: ProductPrice) => {
        setSavingId(pp.id);
        try {
            const res = await fetch(`/api/products/${id}/prices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerGroupId: pp.customerGroupId, price: Number(pp.price) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('บันทึกราคาเรียบร้อย', 'success', 'สำเร็จ');
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingId(null);
        }
    };

    const handleSaveNewPrice = async (row: { customerGroupId: string; price: number }, idx: number) => {
        if (!row.customerGroupId) { showAlert('กรุณาเลือกกลุ่มลูกค้า', 'warning', 'แจ้งเตือน'); return; }
        setSavingId(`new-price-${idx}`);
        try {
            const res = await fetch(`/api/products/${id}/prices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(row),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('เพิ่มราคาเรียบร้อย', 'success', 'สำเร็จ');
            setNewPriceRows(prev => prev.filter((_, i) => i !== idx));
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingId(null);
        }
    };

    const handleDeletePrice = async (pp: ProductPrice) => {
        if (!confirm(`ลบราคากลุ่ม "${pp.customerGroup.name}" ?`)) return;
        try {
            const res = await fetch(`/api/products/${id}/prices?priceId=${pp.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('ลบราคาเรียบร้อย', 'success', 'สำเร็จ');
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        }
    };

    // Unit inline CRUD
    const handleSaveExistingUnit = async (unit: ProductUnit) => {
        setSavingId(unit.id);
        try {
            const res = await fetch(`/api/products/${id}/units/${unit.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitName: unit.unitName, conversionRate: Number(unit.conversionRate), sellingPrice: Number(unit.sellingPrice), isBaseUnit: unit.isBaseUnit }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('บันทึกหน่วยเรียบร้อย', 'success', 'สำเร็จ');
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingId(null);
        }
    };

    const handleSaveNewUnit = async (row: { unitName: string; conversionRate: number; sellingPrice: number; isBaseUnit: boolean }, idx: number) => {
        if (!row.unitName.trim()) { showAlert('กรุณากรอกชื่อหน่วย', 'warning', 'แจ้งเตือน'); return; }
        setSavingId(`new-unit-${idx}`);
        try {
            const res = await fetch(`/api/products/${id}/units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(row),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('เพิ่มหน่วยขายเรียบร้อย', 'success', 'สำเร็จ');
            setNewUnitRows(prev => prev.filter((_, i) => i !== idx));
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteUnit = async (unit: ProductUnit) => {
        if (unit.isBaseUnit) { showAlert('ไม่สามารถลบหน่วยหลักได้', 'warning', 'แจ้งเตือน'); return; }
        if (!confirm(`ลบหน่วย "${unit.unitName}" ?`)) return;
        try {
            const res = await fetch(`/api/products/${id}/units/${unit.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            showAlert('ลบหน่วยขายเรียบร้อย', 'success', 'สำเร็จ');
            await refreshProduct();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        }
    };

    const updateExistingPrice = (ppId: string, field: string, value: any) => {
        if (!product) return;
        setProduct({ ...product, productPrices: product.productPrices.map(pp => pp.id === ppId ? { ...pp, [field]: value } : pp) });
    };

    const updateExistingUnit = (unitId: string, updates: Partial<ProductUnit>) => {
        if (!product) return;
        setProduct({ ...product, productUnits: product.productUnits.map(u => u.id === unitId ? { ...u, ...updates } : u) });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!product) return null;

    const totalStock = product.productStocks.reduce((s, ps) => s + ps.quantity, 0);
    const isLowStock = totalStock < product.minStock;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Back + Header */}
            <button onClick={() => router.push('/products')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                กลับรายการสินค้า
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{product.name}</h1>
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{product.code}</span>
                        {product.productGroup && (
                            <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">{product.productGroup.name}</span>
                        )}
                        {product.brand && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{product.brand}</span>
                        )}
                        {product.packaging && (
                            <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">📦 {product.packaging}</span>
                        )}
                    </div>
                    {product.description && (
                        <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                    )}
                </div>
                <button
                    onClick={async () => {
                        try {
                            const res = await fetch(`/api/products/${id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive: !product.isActive }),
                            });
                            if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
                            await refreshProduct();
                            showAlert(product.isActive ? 'ปิดใช้งานสินค้าแล้ว' : 'เปิดใช้งานสินค้าแล้ว', 'success', 'สำเร็จ');
                        } catch (error) {
                            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
                        }
                    }}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${product.isActive
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                >
                    {product.isActive ? '✅ เปิดใช้งาน' : '🚫 ปิดใช้งาน'}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Stock รวม</p>
                    <p className={`text-xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                        {totalStock.toLocaleString()} <span className="text-sm font-normal text-gray-400">{product.unit}</span>
                        {isLowStock && <span className="text-xs ml-1">⚠️</span>}
                    </p>
                    {product.productStocks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {product.productStocks.map(ps => (
                                <div key={ps.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${ps.quantity < product.minStock ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                                    <span className="font-medium">🏭 {ps.warehouse.name}</span>
                                    <span className="font-bold">{ps.quantity.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">ต้นทุน</p>
                    {editingCost ? (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:border-blue-300">
                                <input type="radio" name="cost-type" checked={costType === 'avg'} onChange={() => setCostType('avg')} className="accent-emerald-500" />
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="text-xs text-gray-700">ต้นทุนเฉลี่ย</span>
                                    <span className="text-xs font-bold text-blue-700">{formatCurrency(globalAvgCost)}</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer hover:border-purple-300">
                                <input type="radio" name="cost-type" checked={costType === 'last'} onChange={() => setCostType('last')} className="accent-emerald-500" />
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="text-xs text-gray-700">ต้นทุนล่าสุด</span>
                                    <span className="text-xs font-bold text-purple-700">{formatCurrency(globalLastCost)}</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:border-amber-300">
                                <input type="radio" name="cost-type" checked={costType === 'custom'} onChange={() => setCostType('custom')} className="accent-emerald-500" />
                                <div className="flex-1 flex justify-between items-center gap-2">
                                    <span className="text-xs text-gray-700">กรอกเอง</span>
                                    {costType === 'custom' && (
                                        <input type="number" min={0} step="0.01" value={customCost}
                                            onChange={e => setCustomCost(parseFloat(e.target.value) || 0)}
                                            className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-xs text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                            autoFocus />
                                    )}
                                </div>
                            </label>
                            <div className="flex gap-1.5 pt-1">
                                <button onClick={() => setEditingCost(false)}
                                    className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">ยกเลิก</button>
                                <button onClick={handleSaveCost} disabled={savingCost}
                                    className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50">
                                    {savingCost ? '...' : '💾 บันทึก'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xl font-bold text-gray-800 cursor-pointer hover:text-emerald-600 transition-colors"
                            onClick={startEditingCost} title="คลิกเพื่อแก้ไข">
                            {formatCurrency(Number(product.cost))} <span className="text-xs font-normal text-gray-400">✏️</span>
                        </p>
                    )}
                </div>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">ราคาขาย</p>
                    {editingSellingPrice ? (
                        <div className="flex items-center gap-2">
                            <input type="number" value={sellingPriceValue || ''}
                                onChange={e => setSellingPriceValue(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold text-emerald-600"
                                min={0} step="0.01" autoFocus />
                            <button onClick={handleSaveSellingPrice} disabled={savingSellingPrice}
                                className="text-blue-500 hover:text-blue-700 text-xs disabled:opacity-50">{savingSellingPrice ? '...' : '💾'}</button>
                            <button onClick={() => setEditingSellingPrice(false)}
                                className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                    ) : (
                        <p className="text-xl font-bold text-emerald-600 cursor-pointer hover:text-emerald-700 transition-colors"
                            onClick={() => { setSellingPriceValue(Number(product.price)); setEditingSellingPrice(true); }}
                            title="คลิกเพื่อแก้ไข">
                            {formatCurrency(Number(product.price))} <span className="text-xs font-normal text-gray-400">✏️</span>
                        </p>
                    )}
                </div>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">แต้ม/หน่วย</p>
                    {editingPoints ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={pointsValue || ''}
                                onChange={e => setPointsValue(parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold text-gray-800"
                                min={0}
                                autoFocus
                            />
                            <button onClick={handleSavePoints} disabled={savingPoints}
                                className="text-blue-500 hover:text-blue-700 text-xs disabled:opacity-50">{savingPoints ? '...' : '💾'}</button>
                            <button onClick={() => setEditingPoints(false)}
                                className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                    ) : (
                        <p className="text-xl font-bold text-gray-800 cursor-pointer hover:text-emerald-600 transition-colors"
                            onClick={() => { setPointsValue(product.pointsPerUnit); setEditingPoints(true); }}
                            title="คลิกเพื่อแก้ไข">
                            {product.pointsPerUnit} <span className="text-xs font-normal text-gray-400">pts ✏️</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Pricing - Inline Rows */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-800">💰 ราคาตามกลุ่มลูกค้า</h2>
                    <button type="button"
                        onClick={() => setNewPriceRows(prev => [...prev, { customerGroupId: '', price: 0 }])}
                        className="text-xs text-blue-600 font-medium hover:underline">
                        + เพิ่มราคา
                    </button>
                </div>
                {((!product.productPrices || product.productPrices.length === 0) && newPriceRows.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีราคาเฉพาะกลุ่ม — จะใช้ราคาขายปกติ ({formatCurrency(Number(product.price))})</p>
                ) : (
                    <div className="space-y-3">
                        {product.productPrices.map(pp => (
                            <div key={pp.id} className="flex items-center gap-3">
                                <select
                                    value={pp.customerGroupId}
                                    disabled
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm bg-gray-100 text-gray-500"
                                >
                                    <option>{pp.customerGroup.name}</option>
                                </select>
                                <input
                                    type="number"
                                    value={Number(pp.price) || ''}
                                    onChange={e => updateExistingPrice(pp.id, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-32 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                    placeholder="0.00"
                                    step="0.01"
                                    min={0}
                                />
                                <span className="text-xs text-gray-400">บาท</span>
                                <button type="button" onClick={() => handleSaveExistingPrice(pp)}
                                    disabled={savingId === pp.id}
                                    className="text-blue-500 hover:text-blue-700 text-xs font-medium px-1 disabled:opacity-50">
                                    {savingId === pp.id ? '...' : '💾'}
                                </button>
                                <button type="button" onClick={() => handleDeletePrice(pp)}
                                    className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                            </div>
                        ))}
                        {newPriceRows.map((p, idx) => (
                            <div key={`new-${idx}`} className="flex items-center gap-3">
                                <select
                                    value={p.customerGroupId}
                                    onChange={e => {
                                        const newRows = [...newPriceRows];
                                        newRows[idx] = { ...newRows[idx], customerGroupId: e.target.value };
                                        setNewPriceRows(newRows);
                                    }}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-blue-50/50"
                                >
                                    <option value="">-- เลือกกลุ่มลูกค้า --</option>
                                    {customerGroups.map(g => (
                                        <option key={g.id} value={g.id}
                                            disabled={product.productPrices.some(pp => pp.customerGroupId === g.id)}>
                                            {g.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={p.price || ''}
                                    onChange={e => {
                                        const newRows = [...newPriceRows];
                                        newRows[idx] = { ...newRows[idx], price: parseFloat(e.target.value) || 0 };
                                        setNewPriceRows(newRows);
                                    }}
                                    className="w-32 px-4 py-2.5 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-blue-50/50"
                                    placeholder="0.00"
                                    step="0.01"
                                    min={0}
                                />
                                <span className="text-xs text-gray-400">บาท</span>
                                <button type="button" onClick={() => handleSaveNewPrice(p, idx)}
                                    disabled={savingId === `new-price-${idx}`}
                                    className="text-emerald-500 hover:text-emerald-700 text-xs font-medium px-1 disabled:opacity-50">
                                    {savingId === `new-price-${idx}` ? '...' : '💾'}
                                </button>
                                <button type="button" onClick={() => setNewPriceRows(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Units - Inline Rows */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-800">📦 หน่วยขาย</h2>
                    <button type="button"
                        onClick={() => {
                            const hasBase = (product?.productUnits?.some(u => u.isBaseUnit) || false) || newUnitRows.some(u => u.isBaseUnit);
                            setNewUnitRows(prev => [...prev, { unitName: '', conversionRate: hasBase ? 1 : 1, sellingPrice: 0, isBaseUnit: !hasBase }]);
                        }}
                        className="text-xs text-emerald-600 font-medium hover:underline">
                        + เพิ่มหน่วย
                    </button>
                </div>
                {((!product.productUnits || product.productUnits.length === 0) && newUnitRows.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีหน่วยขาย — กดปุ่ม "+ เพิ่มหน่วย" เพื่อเริ่มต้น</p>
                ) : (
                    <div className="space-y-3">
                        {product.productUnits.map(unit => (
                            <div key={unit.id} className={`flex items-center gap-3 p-3 rounded-xl border ${unit.isBaseUnit ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                                <div className="flex-1 min-w-0">
                                    <input type="text" value={unit.unitName}
                                        onChange={e => updateExistingUnit(unit.id, { unitName: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                        placeholder="ชื่อหน่วย" />
                                </div>
                                <div className="w-24">
                                    <input type="number" value={Number(unit.conversionRate) || ''}
                                        onChange={e => updateExistingUnit(unit.id, { conversionRate: parseFloat(e.target.value) || 0 })}
                                        disabled={unit.isBaseUnit}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400"
                                        placeholder="อัตรา" min={0.0001} step="0.0001" />
                                </div>
                                <div className="w-28">
                                    <input type="number" value={Number(unit.sellingPrice) || ''}
                                        onChange={e => updateExistingUnit(unit.id, { sellingPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                        placeholder="ราคา" step="0.01" min={0} />
                                </div>
                                <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                                    <input type="checkbox" checked={unit.isBaseUnit} disabled
                                        className="accent-emerald-500 w-3.5 h-3.5" />
                                    <span className="text-[10px] text-gray-500">หลัก</span>
                                </label>
                                <button type="button" onClick={() => handleSaveExistingUnit(unit)}
                                    disabled={savingId === unit.id}
                                    className="text-blue-500 hover:text-blue-700 text-xs font-medium px-1 disabled:opacity-50">
                                    {savingId === unit.id ? '...' : '💾'}
                                </button>
                                {!unit.isBaseUnit && (
                                    <button type="button" onClick={() => handleDeleteUnit(unit)}
                                        className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
                                )}
                            </div>
                        ))}
                        {newUnitRows.map((u, idx) => (
                            <div key={`new-${idx}`} className={`flex items-center gap-3 p-3 rounded-xl border ${u.isBaseUnit ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/30'}`}>
                                <div className="flex-1 min-w-0">
                                    <input type="text" value={u.unitName}
                                        onChange={e => { const nr = [...newUnitRows]; nr[idx] = { ...nr[idx], unitName: e.target.value }; setNewUnitRows(nr); }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                        placeholder="ชื่อหน่วย (เช่น ถุง, ลัง)" />
                                </div>
                                <div className="w-24">
                                    <input type="number" value={u.conversionRate || ''}
                                        onChange={e => { const nr = [...newUnitRows]; nr[idx] = { ...nr[idx], conversionRate: parseFloat(e.target.value) || 0 }; setNewUnitRows(nr); }}
                                        disabled={u.isBaseUnit}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400"
                                        placeholder="อัตรา" min={0.0001} step="0.0001" />
                                </div>
                                <div className="w-28">
                                    <input type="number" value={u.sellingPrice || ''}
                                        onChange={e => { const nr = [...newUnitRows]; nr[idx] = { ...nr[idx], sellingPrice: parseFloat(e.target.value) || 0 }; setNewUnitRows(nr); }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                        placeholder="ราคา" step="0.01" min={0} />
                                </div>
                                <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                                    <input type="checkbox" checked={u.isBaseUnit}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setNewUnitRows(prev => prev.map((uu, i) => ({
                                                ...uu,
                                                isBaseUnit: i === idx ? checked : (checked ? false : uu.isBaseUnit),
                                                conversionRate: i === idx && checked ? 1 : uu.conversionRate,
                                            })));
                                        }}
                                        className="accent-emerald-500 w-3.5 h-3.5" />
                                    <span className="text-[10px] text-gray-500">หลัก</span>
                                </label>
                                <button type="button" onClick={() => handleSaveNewUnit(u, idx)}
                                    disabled={savingId === `new-unit-${idx}`}
                                    className="text-emerald-500 hover:text-emerald-700 text-xs font-medium px-1 disabled:opacity-50">
                                    {savingId === `new-unit-${idx}` ? '...' : '💾'}
                                </button>
                                <button type="button" onClick={() => setNewUnitRows(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
                            </div>
                        ))}
                        <p className="text-[10px] text-gray-400">* หน่วยหลัก (Base) มี conversion rate = 1 | หน่วยอื่นระบุจำนวน base unit ต่อ 1 หน่วยนี้ | กด 💾 เพื่อบันทึกแต่ละแถว</p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('stock')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'stock' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    📦 Stock ตามคลัง
                </button>
                <button
                    onClick={() => setActiveTab('log')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    📋 ประวัติรับ-จ่าย
                </button>
            </div>

            {/* Stock Tab */}
            {activeTab === 'stock' && (
                <div className="space-y-4">
                    {product.productStocks.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-center text-gray-400">
                            ยังไม่มี stock ในคลังสินค้า
                        </div>
                    ) : (
                        product.productStocks.map(stock => (
                            <div key={stock.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🏭</span>
                                        <h3 className="text-sm font-semibold text-gray-700">{stock.warehouse.name}</h3>
                                    </div>
                                    <span className={`text-lg font-bold ${stock.quantity < product.minStock ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {stock.quantity.toLocaleString()} {product.unit}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 rounded-lg p-3">
                                        <p className="text-xs text-blue-400 mb-1">ต้นทุนเฉลี่ย (Avg)</p>
                                        <p className="text-lg font-bold text-blue-700">{formatCurrency(Number(stock.avgCost))}</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-3">
                                        <p className="text-xs text-purple-400 mb-1">ต้นทุนล่าสุด (Last)</p>
                                        <p className="text-lg font-bold text-purple-700">{formatCurrency(Number(stock.lastCost))}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Log Tab */}
            {activeTab === 'log' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    {product.stockTransactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">ยังไม่มีประวัติรับ-จ่ายสินค้า</div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">วันที่</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ประเภท</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">คลัง</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">จำนวน</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">ต้นทุน/หน่วย</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">อ้างอิง</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {product.stockTransactions.map(tx => {
                                            const info = txTypeLabels[tx.type] || { label: tx.type, color: 'text-gray-700 bg-gray-50', icon: '📋' };
                                            return (
                                                <tr key={tx.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(tx.createdAt)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${info.color}`}>
                                                            {info.icon} {info.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{tx.warehouse.name}</td>
                                                    <td className="px-4 py-3 text-sm text-right">
                                                        <span className={tx.type === 'SALE' || tx.type === 'TRANSFER_OUT' ? 'text-red-600' : 'text-emerald-600'}>
                                                            {tx.type === 'SALE' || tx.type === 'TRANSFER_OUT' ? '-' : '+'}
                                                            {tx.quantity.toLocaleString()} {product.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(tx.unitCost))}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500">
                                                        {tx.reference && <span className="bg-gray-100 px-2 py-0.5 rounded">{tx.reference}</span>}
                                                        {tx.notes && <p className="text-gray-400 mt-0.5">{tx.notes}</p>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="sm:hidden divide-y divide-gray-50">
                                {product.stockTransactions.map(tx => {
                                    const info = txTypeLabels[tx.type] || { label: tx.type, color: 'text-gray-700 bg-gray-50', icon: '📋' };
                                    return (
                                        <div key={tx.id} className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${info.color}`}>
                                                    {info.icon} {info.label}
                                                </span>
                                                <span className={`text-sm font-bold ${tx.type === 'SALE' || tx.type === 'TRANSFER_OUT' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {tx.type === 'SALE' || tx.type === 'TRANSFER_OUT' ? '-' : '+'}
                                                    {tx.quantity.toLocaleString()} {product.unit}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>{formatDate(tx.createdAt)}</span>
                                                <span>{tx.warehouse.name}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>@ {formatCurrency(Number(tx.unitCost))}</span>
                                                {tx.reference && <span className="bg-gray-100 px-2 py-0.5 rounded">{tx.reference}</span>}
                                            </div>
                                            {tx.notes && <p className="text-xs text-gray-400 mt-1">{tx.notes}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

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
