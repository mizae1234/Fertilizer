'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createGoodsReceive } from '@/app/actions/goods-receive';
import AlertModal from '@/components/AlertModal';

interface Vendor { id: string; name: string; phone: string | null }
interface Product { id: string; name: string; code: string; unit: string }
interface Warehouse { id: string; name: string }
interface LineItem {
    productId: string;
    productName: string;
    productCode: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
    lotNo: string;
}

// ── Searchable Product Picker ─────────────────────────────
function ProductPicker({
    products,
    value,
    onChange,
}: {
    products: Product[];
    value: string;
    onChange: (productId: string, product: Product) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = products.filter(p =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    );

    const selected = products.find(p => p.id === value);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => { setOpen(!open); setSearch(''); }}
                className="w-full px-3 py-2 sm:py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-left flex items-center justify-between gap-2 hover:border-gray-300 transition-colors"
            >
                <span className={selected ? 'text-gray-800 truncate' : 'text-gray-400 truncate'}>
                    {selected ? `${selected.code} - ${selected.name}` : 'เลือกสินค้า'}
                </span>
                <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-100">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="🔍 ค้นหาสินค้า..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            autoFocus
                        />
                    </div>
                    {/* List */}
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-400">ไม่พบสินค้า</div>
                        ) : (
                            filtered.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { onChange(p.id, p); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2 ${value === p.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'
                                        }`}
                                >
                                    {value === p.id && (
                                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    <span className="font-mono text-xs text-gray-400 shrink-0 w-14">{p.code}</span>
                                    <span className="truncate">{p.name}</span>
                                    <span className="text-xs text-gray-400 ml-auto shrink-0">({p.unit})</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────
export default function NewGoodsReceivePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    const [vendorId, setVendorId] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info'; title?: string }>({ open: false, message: '', type: 'info' });
    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);
    const [items, setItems] = useState<LineItem[]>([]);

    useEffect(() => {
        Promise.all([
            fetch('/api/vendors').then(r => r.json()),
            fetch('/api/products').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
        ]).then(([v, p, w]) => {
            setVendors(v);
            setProducts(p);
            setWarehouses(w);
            if (w.length > 0) setDefaultWarehouseId(w[0].id);
        });
    }, []);

    const addItem = () => {
        setItems([...items, {
            productId: '', productName: '', productCode: '',
            warehouseId: defaultWarehouseId, quantity: 1, unitCost: 0, lotNo: '',
        }]);
    };

    const removeItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
        const updated = [...items];
        updated[idx] = { ...updated[idx], [field]: value };
        setItems(updated);
    };

    const handleProductSelect = (idx: number, productId: string, product: Product) => {
        const updated = [...items];
        updated[idx] = {
            ...updated[idx],
            productId,
            productName: product.name,
            productCode: product.code,
        };
        setItems(updated);
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorId) { showAlert('กรุณาเลือกผู้ขาย/โรงงาน/บริษัท', 'warning', 'ข้อมูลไม่ครบ'); return; }
        const validItems = items.filter(i => i.productId && i.warehouseId && i.quantity > 0);
        if (validItems.length === 0) { showAlert('กรุณาเพิ่มรายการสินค้า', 'warning', 'ข้อมูลไม่ครบ'); return; }

        setLoading(true);
        try {
            const token = document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
            if (!token) { router.push('/login'); return; }
            const payload = JSON.parse(atob(token.split('.')[1]));

            await createGoodsReceive({
                vendorId,
                poNumber: poNumber || undefined,
                receivedDate,
                notes: notes || undefined,
                items: validItems.map(i => ({
                    productId: i.productId,
                    warehouseId: i.warehouseId,
                    quantity: i.quantity,
                    unitCost: i.unitCost,
                    lotNo: i.lotNo || undefined,
                })),
                userId: payload.userId,
            });
            router.push('/goods-receive');
        } catch (error) {
            console.error(error);
            const msg = (error as Error).message;
            if (msg.includes('ไม่พบผู้ใช้งาน') || msg.includes('เข้าสู่ระบบ')) {
                showAlert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error', 'เกิดข้อผิดพลาด');
                setTimeout(() => router.push('/login'), 2000);
            } else {
                showAlert(msg || 'ไม่สามารถบันทึกรายการได้ กรุณาลองใหม่อีกครั้ง', 'error', 'เกิดข้อผิดพลาด');
            }
        } finally {
            setLoading(false);
        }
    };

    // Products not yet in the cart (to avoid duplicates)
    const availableProducts = (currentProductId: string) => {
        const usedIds = items.map(i => i.productId).filter(id => id && id !== currentProductId);
        return products.filter(p => !usedIds.includes(p.id));
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">บันทึกนำเข้าสินค้า</h1>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Vendor + Default Warehouse */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 sm:mb-4">ข้อมูลทั่วไป</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ผู้ขาย/โรงงาน/บริษัท *</label>
                            <select
                                value={vendorId}
                                onChange={(e) => setVendorId(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white"
                                required
                            >
                                <option value="">-- เลือกผู้ขาย/โรงงาน/บริษัท --</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} {v.phone ? `(${v.phone})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">
                                📦 คลังรับสินค้าหลัก *
                            </label>
                            <select
                                value={defaultWarehouseId}
                                onChange={(e) => {
                                    const newWh = e.target.value;
                                    setDefaultWarehouseId(newWh);
                                    // Update all items that haven't been individually overridden
                                    setItems(items.map(item => ({ ...item, warehouseId: newWh })));
                                }}
                                className="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white font-medium"
                                required
                            >
                                <option value="">-- เลือกคลัง --</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">📅 วันที่รับสินค้า *</label>
                            <input
                                type="date"
                                value={receivedDate}
                                onChange={(e) => setReceivedDate(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">เลขที่ PO</label>
                            <input
                                type="text"
                                value={poNumber}
                                onChange={(e) => setPoNumber(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="PO-XXXX (ถ้ามี)"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">หมายเหตุ</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="สั่งผ่าน LINE, เลขอ้างอิง ฯลฯ"
                            />
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700">รายการสินค้า</h2>
                            {items.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">{items.length} รายการ</p>
                            )}
                        </div>
                        <button type="button" onClick={addItem} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                            + เพิ่มรายการ
                        </button>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                            <p className="text-3xl mb-2">📦</p>
                            <p className="text-sm text-gray-400 mb-3">ยังไม่มีรายการ</p>
                            <button type="button" onClick={addItem}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200">
                                + เพิ่มรายการสินค้า
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, idx) => {
                                const isCustomWarehouse = item.warehouseId !== defaultWarehouseId;
                                return (
                                    <div key={idx} className="p-3 sm:p-4 bg-gray-50 rounded-xl">
                                        {/* ─── Desktop: single row ─── */}
                                        <div className="hidden sm:flex items-end gap-2">
                                            <div className="flex-1 min-w-0">
                                                <label className="block text-xs text-gray-500 mb-1">สินค้า</label>
                                                <ProductPicker
                                                    products={availableProducts(item.productId)}
                                                    value={item.productId}
                                                    onChange={(pid, product) => handleProductSelect(idx, pid, product)}
                                                />
                                            </div>
                                            <div className="w-24 shrink-0">
                                                <label className="block text-xs text-gray-500 mb-1">จำนวน</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                                                    min="1"
                                                    required
                                                />
                                            </div>
                                            <div className="w-28 shrink-0">
                                                <label className="block text-xs text-gray-500 mb-1">ต้นทุน/หน่วย</label>
                                                <input
                                                    type="number"
                                                    value={item.unitCost}
                                                    onChange={(e) => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                />
                                            </div>
                                            <div className="w-36 shrink-0">
                                                <label className="block text-xs text-gray-500 mb-1">เข้าคลัง</label>
                                                <select
                                                    value={item.warehouseId}
                                                    onChange={(e) => updateItem(idx, 'warehouseId', e.target.value)}
                                                    className={`w-full px-2 py-2 rounded-lg border text-sm bg-white ${isCustomWarehouse
                                                        ? 'border-orange-300 text-orange-700 font-medium'
                                                        : 'border-gray-200 text-gray-600'
                                                        }`}
                                                >
                                                    {warehouses.map(w => (
                                                        <option key={w.id} value={w.id}>{w.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-28 shrink-0">
                                                <label className="block text-xs text-gray-500 mb-1">Lot No.</label>
                                                <input
                                                    type="text"
                                                    value={item.lotNo}
                                                    onChange={(e) => updateItem(idx, 'lotNo', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                                                    placeholder="LOT-xxx"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removeItem(idx)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 mb-0.5"
                                                title="ลบรายการ">
                                                🗑️
                                            </button>
                                        </div>

                                        {/* ─── Mobile: stacked ─── */}
                                        <div className="sm:hidden space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-gray-400">#{idx + 1}</span>
                                                <button type="button" onClick={() => removeItem(idx)}
                                                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                                                    🗑️ ลบ
                                                </button>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">สินค้า</label>
                                                <ProductPicker
                                                    products={availableProducts(item.productId)}
                                                    value={item.productId}
                                                    onChange={(pid, product) => handleProductSelect(idx, pid, product)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">จำนวน</label>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">ต้นทุน/หน่วย</label>
                                                    <input
                                                        type="number"
                                                        value={item.unitCost}
                                                        onChange={(e) => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                                                        min="0"
                                                        step="0.01"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-gray-400 shrink-0">เข้าคลัง:</label>
                                                <select
                                                    value={item.warehouseId}
                                                    onChange={(e) => updateItem(idx, 'warehouseId', e.target.value)}
                                                    className={`flex-1 px-2 py-1.5 rounded-lg border text-xs bg-white min-w-0 ${isCustomWarehouse
                                                        ? 'border-orange-300 text-orange-700 font-medium'
                                                        : 'border-gray-200 text-gray-600'
                                                        }`}
                                                >
                                                    {warehouses.map(w => (
                                                        <option key={w.id} value={w.id}>{w.name}</option>
                                                    ))}
                                                </select>
                                                {isCustomWarehouse && (
                                                    <button type="button"
                                                        onClick={() => updateItem(idx, 'warehouseId', defaultWarehouseId)}
                                                        className="text-[10px] text-orange-500 hover:text-orange-700 shrink-0">
                                                        รีเซ็ต
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Lot No.</label>
                                                <input
                                                    type="text"
                                                    value={item.lotNo}
                                                    onChange={(e) => updateItem(idx, 'lotNo', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                                                    placeholder="LOT-xxx"
                                                />
                                            </div>
                                        </div>

                                        {/* Item subtotal (both) */}
                                        {item.quantity > 0 && item.unitCost > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-200/50 text-right">
                                                <span className="text-xs text-gray-400">รวม: </span>
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {(item.quantity * item.unitCost).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add another item button */}
                            <button type="button" onClick={addItem}
                                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                                + เพิ่มรายการ
                            </button>
                        </div>
                    )}

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                            <div className="text-right">
                                <p className="text-sm text-gray-500">มูลค่ารวม</p>
                                <p className="text-xl font-bold text-gray-800">
                                    {totalAmount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading || items.length === 0}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึกรับสินค้า'}
                    </button>
                </div>
            </form>
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
