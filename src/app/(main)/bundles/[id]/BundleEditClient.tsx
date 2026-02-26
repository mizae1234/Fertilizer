'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateBundle, deleteBundle } from '@/app/actions/bundles';
import AlertModal from '@/components/AlertModal';
import { formatCurrency } from '@/lib/utils';

interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
    cost: number;
    unit: string;
}

interface BundleItem {
    productId: string;
    product?: Product;
    quantity: number;
}

interface BundleData {
    id: string;
    code: string;
    name: string;
    description: string | null;
    bundlePrice: number;
    bundleCost: number;
    isActive: boolean;
    items: {
        id: string;
        productId: string;
        quantity: number;
        product: Product;
    }[];
}

export default function BundleEditClient({ bundle }: { bundle: BundleData }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState({
        name: bundle.name,
        description: bundle.description || '',
        bundlePrice: Number(bundle.bundlePrice),
        bundleCost: Number(bundle.bundleCost),
    });
    const [items, setItems] = useState<BundleItem[]>(
        bundle.items.map(item => ({
            productId: item.productId,
            product: {
                id: item.product.id,
                code: item.product.code,
                name: item.product.name,
                price: Number(item.product.price),
                cost: Number(item.product.cost),
                unit: item.product.unit,
            },
            quantity: item.quantity,
        }))
    );
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        fetch('/api/products')
            .then(r => r.json())
            .then((data) => setProducts(data.map((p: any) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                price: Number(p.price),
                cost: Number(p.cost),
                unit: p.unit,
            }))));
    }, []);

    const filteredProducts = products.filter(p => {
        const term = searchTerm.toLowerCase();
        return (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)) &&
            !items.some(item => item.productId === p.id);
    });

    const addProduct = (product: Product) => {
        setItems(prev => [...prev, { productId: product.id, product, quantity: 1 }]);
        setSearchTerm('');
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateQuantity = (index: number, quantity: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(1, quantity) } : item));
    };

    const totalRetailPrice = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    const totalItemCost = items.reduce((sum, item) => sum + (item.product?.cost || 0) * item.quantity, 0);
    const savings = totalRetailPrice - form.bundlePrice;
    const profit = form.bundlePrice - form.bundleCost;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            setAlertModal({ open: true, message: 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ', type: 'error' });
            return;
        }
        setLoading(true);
        try {
            await updateBundle(bundle.id, {
                ...form,
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                })),
            });
            setAlertModal({ open: true, message: 'บันทึกชุดสินค้าเรียบร้อยแล้ว', type: 'success' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('ต้องการลบชุดสินค้านี้?')) return;
        setDeleting(true);
        try {
            await deleteBundle(bundle.id);
            router.push('/bundles');
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error' });
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🎁 แก้ไขชุดสินค้า</h1>
                    <p className="text-sm text-gray-500 mt-0.5">รหัส: {bundle.code}</p>
                </div>
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                    {deleting ? 'กำลังลบ...' : '🗑 ลบชุดสินค้า'}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <h2 className="font-semibold text-gray-800">ข้อมูลชุดสินค้า</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">รหัสชุด</label>
                            <input
                                type="text"
                                value={bundle.code}
                                disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ชื่อชุดสินค้า *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">คำอธิบาย</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ต้นทุนชุด (Cost) *</label>
                            <input
                                type="number"
                                value={form.bundleCost || ''}
                                onChange={(e) => setForm({ ...form, bundleCost: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="0.00"
                                step="0.01"
                                min={0}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ราคาขายชุด (Price) *</label>
                            <input
                                type="number"
                                value={form.bundlePrice || ''}
                                onChange={(e) => setForm({ ...form, bundlePrice: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="0.00"
                                step="0.01"
                                min={0}
                                required
                            />
                        </div>
                    </div>

                    {/* Summary */}
                    {items.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>ราคาแยกรวม (ขายเดี่ยว)</span>
                                <span>{formatCurrency(totalRetailPrice)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>ต้นทุนสินค้ารวม (จากสินค้าย่อย)</span>
                                <span>{formatCurrency(totalItemCost)}</span>
                            </div>
                            {form.bundlePrice > 0 && (
                                <>
                                    <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm font-medium">
                                        <span className="text-emerald-700">ลูกค้าประหยัด</span>
                                        <span className={savings > 0 ? 'text-emerald-600' : 'text-gray-400'}>{formatCurrency(savings)}</span>
                                    </div>
                                    {form.bundleCost > 0 && (
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-blue-700">กำไรต่อชุด</span>
                                            <span className={profit > 0 ? 'text-blue-600' : 'text-red-600'}>{formatCurrency(profit)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Product Selection */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <h2 className="font-semibold text-gray-800">📦 สินค้าในชุด ({items.length} รายการ)</h2>

                    {/* Search Products */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="ค้นหาสินค้าเพื่อเพิ่มในชุด..."
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        />
                        {searchTerm && filteredProducts.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                                {filteredProducts.slice(0, 10).map(product => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => addProduct(product)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                                    >
                                        <div>
                                            <span className="text-sm font-medium text-gray-800">{product.name}</span>
                                            <span className="ml-2 text-xs text-gray-400">{product.code}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{formatCurrency(product.price)}/{product.unit}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Items */}
                    {items.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">ยังไม่ได้เลือกสินค้า</p>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.product?.name}</p>
                                        <p className="text-xs text-gray-400">{item.product?.code} · {formatCurrency(item.product?.price || 0)}/{item.product?.unit}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => updateQuantity(idx, item.quantity - 1)}
                                            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">−</button>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                                            className="w-14 text-center px-1 py-1 rounded-lg border border-gray-200 text-sm"
                                            min={1}
                                        />
                                        <button type="button" onClick={() => updateQuantity(idx, item.quantity + 1)}
                                            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">+</button>
                                        <span className="text-xs text-gray-400 w-10">{item.product?.unit}</span>
                                    </div>
                                    <button type="button" onClick={() => removeItem(idx)}
                                        className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/bundles')}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50"
                    >
                        กลับ
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                </div>
            </form>
            <AlertModal
                open={alertModal.open}
                onClose={() => {
                    setAlertModal({ ...alertModal, open: false });
                    if (alertModal.type === 'success') router.refresh();
                }}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.type === 'error' ? 'เกิดข้อผิดพลาด' : 'สำเร็จ'}
            />
        </div>
    );
}
