'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTransfer } from '@/app/actions/transfers';
import AlertModal from '@/components/AlertModal';

interface Product { id: string; code: string; name: string; unit: string; }
interface Warehouse { id: string; name: string; }

export default function NewTransferPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [fromWarehouseId, setFromWarehouseId] = useState('');
    const [toWarehouseId, setToWarehouseId] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<{ productId: string; quantity: number }[]>([{ productId: '', quantity: 1 }]);
    const [itemSearch, setItemSearch] = useState<Record<number, string>>({});
    const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'warning' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
        ]).then(([p, w]) => {
            setProducts(p);
            setWarehouses(w);
            if (w.length >= 2) { setFromWarehouseId(w[0].id); setToWarehouseId(w[1].id); }
            else if (w.length === 1) { setFromWarehouseId(w[0].id); }
        });
    }, []);

    const addItem = () => setItems([...items, { productId: '', quantity: 1 }]);
    const removeItem = (idx: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };
    const updateItem = (idx: number, field: string, value: string | number) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fromWarehouseId === toWarehouseId) { setAlertModal({ open: true, message: 'คลังต้นทางและปลายทางต้องต่างกัน', type: 'warning', title: 'ข้อมูลไม่ถูกต้อง' }); return; }
        if (items.some(i => !i.productId)) { setAlertModal({ open: true, message: 'กรุณาเลือกสินค้าทุกรายการ', type: 'warning', title: 'ข้อมูลไม่ครบ' }); return; }

        setLoading(true);
        try {
            await createTransfer({ fromWarehouseId, toWarehouseId, notes, items });
            router.push('/transfers');
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">สร้างใบโอนสินค้า</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <h2 className="font-semibold text-gray-800">ข้อมูลการโอน</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">จากคลัง *</label>
                            <select value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ไปคลัง *</label>
                            <select value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">หมายเหตุ</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-800">รายการสินค้า</h2>
                        <button type="button" onClick={addItem} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100">+ เพิ่มรายการ</button>
                    </div>
                    <div className="space-y-3">
                        {items.map((item, idx) => {
                            const selectedProduct = products.find(p => p.id === item.productId);
                            return (
                                <div key={idx} className="flex items-end gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="flex-1 relative">
                                        <label className="block text-xs text-gray-500 mb-1">สินค้า</label>
                                        {selectedProduct ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
                                                    <span className="font-mono text-xs text-emerald-600 mr-1">{selectedProduct.code}</span>
                                                    {selectedProduct.name}
                                                </div>
                                                <button type="button" onClick={() => { updateItem(idx, 'productId', ''); setItemSearch(prev => ({ ...prev, [idx]: '' })); }}
                                                    className="text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    value={itemSearch[idx] || ''}
                                                    onChange={e => { setItemSearch(prev => ({ ...prev, [idx]: e.target.value })); setActiveSearchIdx(idx); }}
                                                    onFocus={() => setActiveSearchIdx(idx)}
                                                    placeholder="พิมพ์ชื่อหรือรหัสสินค้า..."
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                {activeSearchIdx === idx && (itemSearch[idx] || '') !== '' && (
                                                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                        {products
                                                            .filter(p => {
                                                                const q = (itemSearch[idx] || '').toLowerCase();
                                                                return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                                                            })
                                                            .slice(0, 20)
                                                            .map(p => (
                                                                <button key={p.id} type="button"
                                                                    onClick={() => { updateItem(idx, 'productId', p.id); setActiveSearchIdx(null); setItemSearch(prev => ({ ...prev, [idx]: '' })); }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-0">
                                                                    <span className="font-mono text-xs text-gray-400 mr-1">{p.code}</span>
                                                                    <span className="text-gray-700">{p.name}</span>
                                                                    <span className="text-xs text-gray-400 ml-1">({p.unit})</span>
                                                                </button>
                                                            ))}
                                                        {products.filter(p => {
                                                            const q = (itemSearch[idx] || '').toLowerCase();
                                                            return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                                                        }).length === 0 && (
                                                                <p className="px-3 py-2 text-sm text-gray-400 text-center">ไม่พบสินค้า</p>
                                                            )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="w-28">
                                        <label className="block text-xs text-gray-500 mb-1">จำนวน</label>
                                        <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" min={1} />
                                    </div>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(idx)} className="pb-2 text-red-400 hover:text-red-600 text-sm">✕</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50">{loading ? 'กำลังบันทึก...' : 'สร้างใบโอน'}</button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))} message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
