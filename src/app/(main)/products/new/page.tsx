'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createProduct } from '@/app/actions/products';
import AlertModal from '@/components/AlertModal';

interface CustomerGroup {
    id: string;
    name: string;
}

interface ProductGroup {
    id: string;
    name: string;
}

export default function NewProductPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [form, setForm] = useState({
        code: '',
        name: '',
        description: '',
        unit: '',
        cost: 0,
        price: 0,
        brand: '',
        packaging: '',
        productGroupId: '',
        pointsPerUnit: 0,
        minStock: 10,
    });
    const [prices, setPrices] = useState<{ customerGroupId: string; productUnitId: string; price: number }[]>([]);
    const [units, setUnits] = useState<{ unitName: string; conversionRate: number; sellingPrice: number; isBaseUnit: boolean }[]>([]);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const [brands, setBrands] = useState<string[]>([]);
    const [packagings, setPackagings] = useState<string[]>([]);
    const [unitNames, setUnitNames] = useState<string[]>([]);
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/customer-groups').then(r => r.json()),
            fetch('/api/product-groups').then(r => r.json()),
            fetch('/api/products/brands').then(r => r.json()),
            fetch('/api/products/packagings').then(r => r.json()),
            fetch('/api/products/unit-names').then(r => r.json()),
        ]).then(([cg, pg, br, pk, un]) => {
            setCustomerGroups(cg);
            setProductGroups(pg);
            setBrands(Array.isArray(br) ? br : []);
            setPackagings(Array.isArray(pk) ? pk : []);
            setUnitNames(Array.isArray(un) ? un : []);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createProduct({
                ...form,
                imageUrl: imageUrl || undefined,
                productGroupId: form.productGroupId || undefined,
                prices: prices.filter((p) => p.price > 0),
                units: units.filter((u) => u.unitName.trim() !== ''),
            });
            router.push('/products');
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'อัปโหลดล้มเหลว');
            setImageUrl(data.url);
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Image Upload */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                    <h2 className="font-semibold text-gray-800 mb-3">🖼️ รูปสินค้า</h2>
                    <div className="flex items-center gap-4">
                        {imageUrl ? (
                            <img src={imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                        ) : (
                            <div className="w-24 h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                                ไม่มีรูป
                            </div>
                        )}
                        <div>
                            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                                {uploading ? '⏳ กำลังอัปโหลด...' : (imageUrl ? '🔄 เปลี่ยนรูป' : '📷 อัปโหลดรูป')}
                            </label>
                            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP (สูงสุด 5MB)</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <h2 className="font-semibold text-gray-800">ข้อมูลสินค้า</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">ชื่อสินค้า *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                            required
                        />
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
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">หมวดหมู่สินค้า</label>
                            <select
                                value={form.productGroupId}
                                onChange={(e) => setForm({ ...form, productGroupId: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                            >
                                <option value="">-- ไม่ระบุ --</option>
                                {productGroups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ยี่ห้อ (Brand)</label>
                            <input
                                type="text"
                                value={form.brand}
                                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                                list="brand-suggestions-new"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="พิมพ์เพื่อค้นหาหรือเพิ่มใหม่"
                            />
                            <datalist id="brand-suggestions-new">
                                {brands.map(b => <option key={b} value={b} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">บรรจุภัณฑ์</label>
                            <input
                                type="text"
                                value={form.packaging}
                                onChange={(e) => setForm({ ...form, packaging: e.target.value })}
                                list="packaging-suggestions-new"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="พิมพ์เพื่อค้นหาหรือเพิ่มใหม่"
                            />
                            <datalist id="packaging-suggestions-new">
                                {packagings.map(p => <option key={p} value={p} />)}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ต้นทุน (Cost)</label>
                            <input
                                type="number"
                                value={form.cost || ''}
                                onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="0.00"
                                step="0.01"
                                min={0}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">ราคาขาย (Price)</label>
                            <input
                                type="number"
                                value={form.price || ''}
                                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="0.00"
                                step="0.01"
                                min={0}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">หน่วยนับ</label>
                            <input
                                type="text"
                                value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                list="unit-suggestions-new"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="เช่น ถุง, ขวด, กก., ตัน..."
                            />
                            <datalist id="unit-suggestions-new">
                                {unitNames.map(u => <option key={u} value={u} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">แต้ม/หน่วย</label>
                            <input
                                type="number"
                                value={form.pointsPerUnit}
                                onChange={(e) => setForm({ ...form, pointsPerUnit: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                min={0}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">Stock ขั้นต่ำ</label>
                            <input
                                type="number"
                                value={form.minStock}
                                onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 10 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                min={0}
                            />
                        </div>
                    </div>
                </div>

                {/* Units Section (moved above Pricing) */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800">📦 หน่วยขาย</h2>
                        <button type="button"
                            onClick={() => setUnits(prev => [...prev, { unitName: '', conversionRate: prev.length === 0 ? 1 : 1, sellingPrice: 0, isBaseUnit: prev.length === 0 }])}
                            className="text-xs text-emerald-600 font-medium hover:underline">
                            + เพิ่มหน่วย
                        </button>
                    </div>
                    {units.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีหน่วยขาย — สามารถเพิ่มทีหลังในหน้ารายละเอียดสินค้าได้</p>
                    ) : (
                        <div className="space-y-3">
                            {units.map((u, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                                    <div className="flex-1 min-w-0">
                                        <input
                                            type="text"
                                            value={u.unitName}
                                            onChange={(e) => {
                                                const newUnits = [...units];
                                                newUnits[idx] = { ...newUnits[idx], unitName: e.target.value };
                                                setUnits(newUnits);
                                            }}
                                            list="unit-name-suggestions-new"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                            placeholder="ชื่อหน่วย (เช่น ถุง, ลัง)"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="number"
                                            value={u.conversionRate || ''}
                                            onChange={(e) => {
                                                const newUnits = [...units];
                                                newUnits[idx] = { ...newUnits[idx], conversionRate: parseFloat(e.target.value) || 0 };
                                                setUnits(newUnits);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                            placeholder="จำนวน"
                                            min={0.0001}
                                            step="0.0001"
                                        />
                                    </div>
                                    <div className="w-28">
                                        <input
                                            type="number"
                                            value={u.sellingPrice || ''}
                                            onChange={(e) => {
                                                const newUnits = [...units];
                                                newUnits[idx] = { ...newUnits[idx], sellingPrice: parseFloat(e.target.value) || 0 };
                                                setUnits(newUnits);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                            placeholder="ราคา"
                                            step="0.01"
                                            min={0}
                                        />
                                    </div>
                                    <button type="button" onClick={() => setUnits(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
                                </div>
                            ))}
                            <datalist id="unit-name-suggestions-new">
                                {unitNames.map(u => <option key={u} value={u} />)}
                            </datalist>
                            <p className="text-[10px] text-gray-400">* ระบุจำนวน base unit ต่อ 1 หน่วยนี้</p>
                        </div>
                    )}
                </div>

                {/* Pricing per Customer Group (moved below Units) */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800">💰 ราคาตามกลุ่มลูกค้า</h2>
                        <button type="button"
                            onClick={() => setPrices(prev => [...prev, { customerGroupId: '', productUnitId: '', price: 0 }])}
                            className="text-xs text-emerald-600 font-medium hover:underline">
                            + เพิ่มราคา
                        </button>
                    </div>
                    {prices.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีราคาเฉพาะกลุ่ม — จะใช้ราคาขายปกติ</p>
                    ) : (
                        <div className="space-y-3">
                            {prices.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    <select
                                        value={p.customerGroupId}
                                        onChange={(e) => {
                                            const newPrices = [...prices];
                                            newPrices[idx] = { ...newPrices[idx], customerGroupId: e.target.value };
                                            setPrices(newPrices);
                                        }}
                                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                    >
                                        <option value="">-- เลือกกลุ่มลูกค้า --</option>
                                        {customerGroups.map(g => (
                                            <option key={g.id} value={g.id} disabled={prices.some((pp, i) => i !== idx && pp.customerGroupId === g.id)}>
                                                {g.name}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={p.productUnitId}
                                        onChange={(e) => {
                                            const newPrices = [...prices];
                                            newPrices[idx] = { ...newPrices[idx], productUnitId: e.target.value };
                                            setPrices(newPrices);
                                        }}
                                        className="w-28 px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                    >
                                        <option value="">{form.unit || 'หน่วยหลัก'} (หลัก)</option>
                                        {units.filter(u => u.unitName.trim()).map((u, uIdx) => (
                                            <option key={uIdx} value={`unit-${uIdx}`}>{u.unitName}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={p.price || ''}
                                        onChange={(e) => {
                                            const newPrices = [...prices];
                                            newPrices[idx] = { ...newPrices[idx], price: parseFloat(e.target.value) || 0 };
                                            setPrices(newPrices);
                                        }}
                                        className="w-28 px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                        placeholder="0.00"
                                        step="0.01"
                                        min={0}
                                    />
                                    <span className="text-xs text-gray-400">บาท</span>
                                    <button type="button" onClick={() => setPrices(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal({ open: false, message: '' })} message={alertModal.message} type="error" title="เกิดข้อผิดพลาด" />
        </div>
    );
}
