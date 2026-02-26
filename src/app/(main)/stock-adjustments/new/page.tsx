'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createStockAdjustment } from '@/app/actions/stock-adjustments';
import AlertModal from '@/components/AlertModal';

interface Product { id: string; name: string; code: string; unit: string }
interface Warehouse { id: string; name: string }

interface AdjustmentItem {
    productId: string;
    productName: string;
    productCode: string;
    productUnit: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    reason: string;
    currentStock: number | null;
}

const REASONS = ['ชำรุด', 'สูญหาย', 'หมดอายุ', 'เสียหายจากน้ำท่วม', 'ตรวจนับขาด', 'อื่นๆ'];

function ProductSearchSelect({ products, value, onChange }: {
    products: Product[];
    value: string;
    onChange: (productId: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = products.find(p => p.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={open ? search : (selected ? `${selected.code} - ${selected.name}` : '')}
                placeholder="ค้นหาสินค้า..."
                onFocus={() => { setOpen(true); setSearch(''); }}
                onChange={e => { setSearch(e.target.value); setOpen(true); }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none"
            />
            {selected && !open && (
                <button onClick={() => { onChange(''); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400 text-center">ไม่พบสินค้า</div>
                    ) : (
                        filtered.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-red-50 transition-colors ${p.id === value ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700'}`}
                            >
                                <span className="font-mono text-xs text-gray-400 mr-2">{p.code}</span>
                                {p.name}
                                <span className="text-xs text-gray-400 ml-1">({p.unit})</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function NewStockAdjustmentPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [items, setItems] = useState<AdjustmentItem[]>([{
        productId: '', productName: '', productCode: '', productUnit: '',
        warehouseId: '', warehouseName: '',
        quantity: 1, reason: 'ชำรุด', currentStock: null,
    }]);
    const [saving, setSaving] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
        ]).then(([p, w]) => {
            setProducts(p);
            setWarehouses(w);
            if (w.length > 0) {
                setItems(prev => prev.map(item => ({ ...item, warehouseId: w[0].id, warehouseName: w[0].name })));
            }
        });
    }, []);

    const fetchStock = async (productId: string, warehouseId: string, idx: number) => {
        if (!productId || !warehouseId) return;
        try {
            const res = await fetch(`/api/products/${productId}`);
            const data = await res.json();
            const stock = data.productStocks?.find((s: { warehouseId: string; quantity: number }) => s.warehouseId === warehouseId);
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, currentStock: stock?.quantity ?? 0 } : item));
        } catch {
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, currentStock: 0 } : item));
        }
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            productId: '', productName: '', productCode: '', productUnit: '',
            warehouseId: warehouses[0]?.id || '', warehouseName: warehouses[0]?.name || '',
            quantity: 1, reason: 'ชำรุด', currentStock: null,
        }]);
    };

    const removeItem = (idx: number) => {
        setItems(prev => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, i) => i !== idx);
        });
    };

    const updateItem = (idx: number, field: string, value: unknown) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const handleProductChange = (idx: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setItems(prev => {
                const updated = [...prev];
                const warehouseId = updated[idx].warehouseId;
                updated[idx] = { ...updated[idx], productId, productName: product.name, productCode: product.code, productUnit: product.unit, currentStock: null };
                fetchStock(productId, warehouseId, idx);
                return updated;
            });
        } else {
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, productId: '', productName: '', productCode: '', productUnit: '', currentStock: null } : item));
        }
    };

    const handleWarehouseChange = (idx: number, warehouseId: string) => {
        const wh = warehouses.find(w => w.id === warehouseId);
        if (wh) {
            setItems(prev => {
                const updated = [...prev];
                const productId = updated[idx].productId;
                updated[idx] = { ...updated[idx], warehouseId, warehouseName: wh.name, currentStock: null };
                fetchStock(productId, warehouseId, idx);
                return updated;
            });
        }
    };

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.productId && i.warehouseId && i.quantity > 0);
        if (validItems.length === 0) {
            setAlertModal({ open: true, message: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', type: 'error', title: 'ข้อมูลไม่ครบ' });
            return;
        }

        setSaving(true);
        try {
            const userId = localStorage.getItem('userId') || '';
            const result = await createStockAdjustment({
                items: validItems.map(i => ({
                    productId: i.productId,
                    warehouseId: i.warehouseId,
                    quantity: i.quantity,
                    reason: i.reason,
                })),
                userId,
            });
            setAlertModal({
                open: true,
                message: `บันทึกปรับปรุง Stock สำเร็จ\nเลขที่: ${result.adjNumber}`,
                type: 'success',
                title: 'สำเร็จ',
            });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.push('/stock-adjustments')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">📉 บันทึกปรับปรุง Stock</h1>
                    <p className="text-sm text-gray-500 mt-1">ตัด stock สินค้าชำรุด/สูญหาย</p>
                </div>
            </div>

            {/* Items */}
            <div className="space-y-4 mb-6">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-400">รายการ #{idx + 1}</span>
                            {items.length > 1 && (
                                <button onClick={() => removeItem(idx)} className="text-xs text-red-400 hover:text-red-600">✕ ลบ</button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Product — Searchable */}
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">สินค้า *</label>
                                <ProductSearchSelect
                                    products={products}
                                    value={item.productId}
                                    onChange={(id) => handleProductChange(idx, id)}
                                />
                            </div>
                            {/* Warehouse */}
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">คลัง *</label>
                                <select
                                    value={item.warehouseId}
                                    onChange={e => handleWarehouseChange(idx, e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                >
                                    <option value="">เลือกคลัง</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Quantity */}
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">
                                    จำนวนที่ตัด *
                                    {item.currentStock !== null && (
                                        <span className="ml-2 text-emerald-600">(คงเหลือ: {item.currentStock} {item.productUnit})</span>
                                    )}
                                </label>
                                <input
                                    type="number" min={1} max={item.currentStock ?? undefined}
                                    value={item.quantity}
                                    onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                            {/* Reason */}
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">เหตุผล *</label>
                                <select
                                    value={REASONS.includes(item.reason) ? item.reason : 'อื่นๆ'}
                                    onChange={e => updateItem(idx, 'reason', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                >
                                    {REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Custom reason */}
                            {item.reason === 'อื่นๆ' && (
                                <div className="sm:col-span-2">
                                    <label className="text-xs text-gray-400 mb-1 block">ระบุเหตุผล</label>
                                    <input
                                        type="text"
                                        placeholder="ระบุเหตุผล..."
                                        onChange={e => updateItem(idx, 'reason', e.target.value || 'อื่นๆ')}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                        {/* Warning if over stock */}
                        {item.currentStock !== null && item.quantity > item.currentStock && (
                            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                                ⚠️ จำนวนที่ตัดมากกว่า stock คงเหลือ ({item.currentStock} {item.productUnit})
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Item Button */}
            <button onClick={addItem} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium hover:border-red-300 hover:text-red-500 transition-colors mb-6">
                + เพิ่มรายการ
            </button>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold text-base hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-200 disabled:opacity-50 transition-all"
            >
                {saving ? '⏳ กำลังบันทึก...' : '📉 บันทึกปรับปรุง Stock'}
            </button>

            <AlertModal
                open={alertModal.open}
                onClose={() => {
                    setAlertModal(prev => ({ ...prev, open: false }));
                    if (alertModal.type === 'success') router.push('/stock-adjustments');
                }}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}
