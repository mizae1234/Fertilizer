'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createFactoryReturn } from '@/app/actions/factory-returns';
import { formatCurrency } from '@/lib/utils';
import AlertModal from '@/components/AlertModal';

interface Vendor { id: string; name: string }
interface Product { id: string; name: string; code: string; unit: string; cost: string; productStocks: { warehouseId: string; quantity: number }[] }
interface Warehouse { id: string; name: string }

interface ReturnItem {
    productId: string; productName: string; productCode: string; unit: string;
    warehouseId: string;
    quantity: number; unitCost: number;
    availableStock: number;
}

export default function NewFactoryReturnPage() {
    const router = useRouter();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [vendorId, setVendorId] = useState('');
    const [items, setItems] = useState<ReturnItem[]>([]);
    const [notes, setNotes] = useState('');
    const [senderName, setSenderName] = useState('');
    const [receiverName, setReceiverName] = useState('');

    // Product search (on-demand)
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [searching, setSearching] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Alert modal
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' }>({ show: false, title: '', message: '', type: 'success' });

    useEffect(() => {
        Promise.all([
            fetch('/api/vendors').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
            fetch('/api/shop-info').then(r => r.json()).catch(() => null),
        ]).then(([v, w, shopInfo]) => {
            setVendors(v);
            setWarehouses(w);
            if (shopInfo?.name) setSenderName(shopInfo.name);
            setLoading(false);
        });
    }, []);

    // Debounced product search
    const handleProductSearch = (term: string) => {
        setProductSearch(term);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/products?search=${encodeURIComponent(term.trim())}`);
                const data = await res.json();
                setSearchResults(Array.isArray(data) ? data : []);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 300);
    };

    const addProduct = (product: Product) => {
        const defaultWhId = warehouses[0]?.id || '';
        const stock = product.productStocks?.find(ps => ps.warehouseId === defaultWhId);
        setItems([...items, {
            productId: product.id, productName: product.name, productCode: product.code, unit: product.unit,
            warehouseId: defaultWhId,
            quantity: 1,
            unitCost: Number(product.cost),
            availableStock: stock?.quantity || 0,
        }]);
        setShowProductPicker(false);
        setProductSearch('');
        setSearchResults([]);
    };

    const updateItem = (idx: number, field: string, value: any) => {
        setItems(items.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [field]: value };
            return updated;
        }));
    };

    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

    const handleSubmit = async () => {
        if (!vendorId) {
            setAlertModal({ show: true, title: 'ข้อผิดพลาด', message: 'กรุณาเลือกผู้ขาย/โรงงาน/บริษัท', type: 'error' });
            return;
        }
        if (items.length === 0) {
            setAlertModal({ show: true, title: 'ข้อผิดพลาด', message: 'กรุณาเพิ่มรายการสินค้า', type: 'error' });
            return;
        }
        for (const item of items) {
            if (item.quantity <= 0) {
                setAlertModal({ show: true, title: 'ข้อผิดพลาด', message: `สินค้า ${item.productName}: จำนวนต้องมากกว่า 0`, type: 'error' });
                return;
            }
        }

        setSaving(true);
        try {
            // Get userId from cookie
            const cookie = document.cookie.split(';').find(c => c.trim().startsWith('token='));
            let userId = '';
            if (cookie) {
                try {
                    const payload = JSON.parse(atob(cookie.split('.')[1]));
                    userId = payload.userId;
                } catch { }
            }

            const result = await createFactoryReturn({
                vendorId,
                items: items.map(i => ({
                    productId: i.productId,
                    warehouseId: i.warehouseId,
                    quantity: i.quantity,
                    unitCost: i.unitCost,
                })),
                senderName: senderName || undefined,
                receiverName: receiverName || undefined,
                notes: notes || undefined,
                userId,
            });
            setAlertModal({ show: true, title: 'สำเร็จ', message: `สร้างใบเคลมคืน ${result.returnNumber} สำเร็จ`, type: 'success' });
            setTimeout(() => router.push('/factory-returns'), 1500);
        } catch (err: any) {
            setAlertModal({ show: true, title: 'ข้อผิดพลาด', message: err.message || 'เกิดข้อผิดพลาด', type: 'error' });
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
    );

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            <AlertModal
                open={alertModal.show}
                onClose={() => setAlertModal({ ...alertModal, show: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
            />

            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">🔙 สร้างใบเคลมคืนโรงงาน</h1>
                <p className="text-sm text-gray-500 mt-1">บันทึกการส่งสินค้าคืนผู้ส่งสินค้า/โรงงาน</p>
            </div>

            {/* Vendor & Notes */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ขาย/โรงงาน/บริษัท <span className="text-red-500">*</span></label>
                        <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                            className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-orange-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors">
                            <option value="">เลือกผู้ขาย/โรงงาน/บริษัท...</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="รายละเอียดเพิ่มเติม"
                            className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-orange-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" />
                    </div>
                </div>
            </div>

            {/* Product Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800">รายการสินค้า ({items.length} รายการ)</h2>
                    <div className="relative">
                        <button onClick={() => setShowProductPicker(!showProductPicker)}
                            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
                            + เพิ่มสินค้า
                        </button>
                        {showProductPicker && (
                            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                                <div className="p-3 border-b">
                                    <input type="text" autoFocus placeholder="พิมพ์ค้นหาสินค้า..." value={productSearch}
                                        onChange={e => handleProductSearch(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                    {!productSearch.trim() ? (
                                        <p className="px-4 py-6 text-center text-sm text-gray-400">พิมพ์ชื่อหรือรหัสสินค้าเพื่อค้นหา</p>
                                    ) : searching ? (
                                        <p className="px-4 py-6 text-center text-sm text-gray-400">⏳ กำลังค้นหา...</p>
                                    ) : searchResults.length === 0 ? (
                                        <p className="px-4 py-6 text-center text-sm text-gray-400">ไม่พบสินค้า</p>
                                    ) : (
                                        searchResults.map((p: Product) => (
                                            <button key={p.id} onClick={() => addProduct(p)}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                                <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                                <p className="text-xs text-gray-400">{p.code} · {p.unit} · ต้นทุน {formatCurrency(Number(p.cost))}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <button onClick={() => { setShowProductPicker(false); setProductSearch(''); setSearchResults([]); }}
                                    className="w-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 border-t">ปิด</button>
                            </div>
                        )}
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                        กดปุ่ม &quot;+ เพิ่มสินค้า&quot; เพื่อเพิ่มรายการ
                    </div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">สินค้า</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">คลัง</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">จำนวน</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">ราคาต้นทุน</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">รวม</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                                            <td className="px-3 py-2">
                                                <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                                                <p className="text-xs text-gray-400">{item.productCode} · {item.unit}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <select value={item.warehouseId} onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                                                    className="px-2 py-1 rounded border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-orange-500">
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                                <p className="text-[10px] text-gray-400 mt-0.5">คงเหลือ: {item.availableStock}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" min={1} value={item.quantity} onFocus={e => e.target.select()} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 rounded border border-gray-200 text-sm text-right outline-none focus:ring-1 focus:ring-orange-500" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" step="0.01" value={item.unitCost} onFocus={e => e.target.select()} onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 rounded border border-gray-200 text-sm text-right outline-none focus:ring-1 focus:ring-orange-500" />
                                            </td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right">{formatCurrency(item.quantity * item.unitCost)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 bg-gray-50">
                                        <td colSpan={5} className="px-3 py-3 text-right text-sm font-bold text-gray-700">ยอดรวมทั้งหมด</td>
                                        <td className="px-3 py-3 text-right text-lg font-bold text-orange-600">{formatCurrency(totalAmount)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Mobile */}
                        <div className="md:hidden space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-xl p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{item.productName}</p>
                                            <p className="text-xs text-gray-400">{item.productCode} · {item.unit}</p>
                                        </div>
                                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-gray-400">คลัง</label>
                                            <select value={item.warehouseId} onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                                                className="w-full px-2 py-1 rounded border border-gray-200 text-xs outline-none">
                                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400">จำนวน (คงเหลือ: {item.availableStock})</label>
                                            <input type="number" min={1} value={item.quantity} onFocus={e => e.target.select()} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                className="w-full px-2 py-1 rounded border border-gray-200 text-xs text-right outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400">ราคาต้นทุน</label>
                                            <input type="number" step="0.01" value={item.unitCost} onFocus={e => e.target.select()} onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1 rounded border border-gray-200 text-xs text-right outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400">รวม</label>
                                            <p className="text-sm font-semibold text-gray-800 mt-1">{formatCurrency(item.quantity * item.unitCost)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-orange-50 rounded-xl p-3 text-right">
                                <span className="text-sm text-gray-600 mr-2">ยอดรวม:</span>
                                <span className="text-lg font-bold text-orange-600">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Signatures */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">✍️ ลงชื่อ</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ส่งสินค้าคืน</label>
                        <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
                            placeholder="ชื่อผู้ส่งสินค้าคืน"
                            className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-orange-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ตรวจนับและรับสินค้าคืน</label>
                        <input type="text" value={receiverName} onChange={e => setReceiverName(e.target.value)}
                            placeholder="ชื่อผู้ตรวจนับ"
                            className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-orange-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" />
                    </div>
                </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
                <button onClick={handleSubmit} disabled={saving}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium text-sm hover:from-orange-600 hover:to-red-600 shadow-md disabled:opacity-50 transition-all">
                    {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกใบเคลมคืน'}
                </button>
                <button onClick={() => router.back()}
                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors">
                    ยกเลิก
                </button>
            </div>
        </div>
    );
}
