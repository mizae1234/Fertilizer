'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createQuotation } from '@/app/actions/quotations';
import PageHeader from '@/components/PageHeader';
import AlertModal from '@/components/AlertModal';
import { formatCurrency } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

interface Product { id: string; code: string; name: string; unit: string; price: string | number; }
interface Customer { id: string; name: string; phone: string; }

interface QuotationItem {
    productId: string;
    quantity: number;
    unitPrice: number;
    unitName: string;
}

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
                placeholder="🔍 ค้นหาสินค้า..."
                onFocus={() => { setOpen(true); setSearch(''); }}
                onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            {selected && !open && (
                <button onClick={() => { onChange(''); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
            {open && search.trim().length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400 text-center">ไม่พบสินค้า</div>
                    ) : (
                        filtered.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${p.id === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
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

export default function NewQuotationPage() {
    const router = useRouter();
    const user = useUser();

    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [items, setItems] = useState<QuotationItem[]>([{ productId: '', quantity: 1, unitPrice: 0, unitName: '' }]);
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [notes, setNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/customers').then(r => r.json()),
        ]).then(([prods, custs]) => {
            setProducts(prods);
            setCustomers(custs);
        });
    }, []);

    const updateItem = (idx: number, field: string, value: string | number) => {
        setItems(prev => {
            const copy = [...prev];
            if (field === 'productId') {
                const prod = products.find(p => p.id === value);
                copy[idx] = { ...copy[idx], productId: value as string, unitPrice: Number(prod?.price || 0), unitName: prod?.unit || '' };
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (copy[idx] as any)[field] = field === 'quantity' || field === 'unitPrice' ? Number(value) || 0 : value;
            }
            return copy;
        });
    };

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const total = subtotal - discount;

    const handleSubmit = async () => {
        if (items.every(i => !i.productId)) { setAlertModal({ open: true, message: 'กรุณาเพิ่มรายการสินค้า', type: 'error' }); return; }
        if (!user?.userId) { setAlertModal({ open: true, message: 'ไม่พบผู้ใช้งาน', type: 'error' }); return; }
        setSaving(true);
        try {
            const result = await createQuotation({
                customerId: customerId || undefined,
                customerName: customerName || undefined,
                validUntil: validUntil || undefined,
                notes: notes || undefined,
                discount,
                userId: user.userId,
                items: items.filter(i => i.productId).map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    unitName: i.unitName || undefined,
                })),
            });
            router.push(`/quotations/${result.id}`);
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setSaving(false); }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <button onClick={() => router.push('/quotations')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                กลับ
            </button>
            <PageHeader title="📋 สร้างใบเสนอราคาใหม่" />

            {/* Customer */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <h2 className="font-semibold text-gray-800 mb-3">👤 ข้อมูลลูกค้า</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">เลือกลูกค้า (ถ้ามี)</label>
                        <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                            <option value="">-- ไม่ระบุ --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">หรือ พิมพ์ชื่อลูกค้า</label>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                            placeholder="ชื่อลูกค้า..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">ใบเสนอราคาหมดอายุ</label>
                        <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-semibold text-gray-800">🛒 รายการสินค้า</h2>
                    <button onClick={() => setItems(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0, unitName: '' }])}
                        className="text-xs text-emerald-600 font-medium hover:underline">+ เพิ่มรายการ</button>
                </div>
                <div className="divide-y divide-gray-50">
                    {items.map((item, idx) => (
                        <div key={idx} className="py-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">#{idx + 1}</span>
                                {items.length > 1 && (
                                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:underline">ลบ</button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <ProductSearchSelect
                                        products={products}
                                        value={item.productId}
                                        onChange={(pid) => updateItem(idx, 'productId', pid)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">จำนวน</label>
                                    <input type="number" min={1} value={item.quantity || ''} onFocus={e => e.target.select()}
                                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">ราคา/หน่วย</label>
                                    <input type="number" min={0} step="0.01" value={item.unitPrice || ''} onFocus={e => e.target.select()}
                                        onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            <div className="text-xs text-right text-gray-500">
                                รวม: {formatCurrency(item.quantity * item.unitPrice)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notes + Discount */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">📝 หมายเหตุ</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="หมายเหตุเพิ่มเติม..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm text-gray-600 shrink-0">🏷️ ส่วนลด</label>
                    <input type="number" min={0} step="0.01" value={discount || ''} onFocus={e => e.target.select()}
                        onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        placeholder="0" className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm text-red-500 focus:ring-2 focus:ring-red-300 outline-none text-right" />
                    <span className="text-xs text-gray-400">บาท</span>
                </div>
                <div className="space-y-1 border-t border-gray-100 pt-3">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>ยอดรวมสินค้า</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-red-500">
                            <span>ส่วนลด</span>
                            <span>-{formatCurrency(discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                        <span className="text-gray-800">รวมทั้งสิ้น</span>
                        <span className="text-emerald-600">{formatCurrency(total)}</span>
                    </div>
                </div>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 shadow-md shadow-emerald-200 disabled:opacity-50 transition-colors mb-8">
                {saving ? '⏳ กำลังบันทึก...' : '📋 สร้างใบเสนอราคา'}
            </button>

            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
