'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { updateSale, cancelSale } from '@/app/actions/sales';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

interface SaleDetail {
    id: string; saleNumber: string; status: string;
    totalAmount: string; totalPoints: number; createdAt: string;
    customerId: string | null;
    notes: string | null;
    customer: { name: string; phone: string } | null;
    createdBy: { name: string };
    items: {
        id: string; quantity: number; unitPrice: string; totalPrice: string; points: number;
        unitName: string | null;
        productId: string; warehouseId: string;
        product: { name: string; code: string; unit: string; productUnits: { unitName: string; conversionRate: string }[] };
        warehouse: { name: string };
    }[];
}

interface Product { id: string; code: string; name: string; unit: string; pointsPerUnit: number; productStocks: { warehouseId: string; quantity: number }[]; }
interface Warehouse { id: string; name: string; }
interface Customer { id: string; name: string; phone: string; }

interface EditItem {
    productId: string;
    warehouseId: string;
    quantity: number;
    unitPrice: number;
    points: number;
}

export default function SaleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const user = useUser();

    const [sale, setSale] = useState<SaleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Edit state
    const [items, setItems] = useState<EditItem[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [editNotes, setEditNotes] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Reference data
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // Modals
    const [showDelete, setShowDelete] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    const showAlert = useCallback((message: string, type: 'success' | 'error' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);

    useEffect(() => {
        fetch(`/api/sales/${id}`).then(r => r.json()).then(data => { setSale(data); setLoading(false); });
    }, [id]);

    const startEditing = async () => {
        if (!sale) return;
        // Load reference data
        const [prods, whs, custs] = await Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
            fetch('/api/customers').then(r => r.json()),
        ]);
        setProducts(prods);
        setWarehouses(whs);
        setCustomers(custs);
        setSelectedCustomerId(sale.customerId || '');
        setEditNotes(sale.notes || '');
        setItems(sale.items.map(i => ({
            productId: i.productId,
            warehouseId: i.warehouseId,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            points: i.points,
        })));
        setIsEditing(true);
    };

    const updateItem = (index: number, field: string, value: string | number) => {
        setItems(prev => {
            const copy = [...prev];
            if (field === 'productId') {
                const prod = products.find(p => p.id === value);
                copy[index] = { ...copy[index], productId: value as string, points: (prod?.pointsPerUnit || 0) * copy[index].quantity };
            } else if (field === 'quantity') {
                const qty = Number(value) || 0;
                const prod = products.find(p => p.id === copy[index].productId);
                copy[index] = { ...copy[index], quantity: qty, points: (prod?.pointsPerUnit || 0) * qty };
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (copy[index] as any)[field] = field === 'unitPrice' ? Number(value) || 0 : value;
            }
            return copy;
        });
    };

    const addItem = () => {
        if (warehouses.length === 0) return;
        setItems(prev => [...prev, { productId: '', warehouseId: warehouses[0].id, quantity: 1, unitPrice: 0, points: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (items.length === 0) { showAlert('กรุณาเพิ่มรายการสินค้า', 'error'); return; }
        if (items.some(i => !i.productId)) { showAlert('กรุณาเลือกสินค้าทุกรายการ', 'error'); return; }
        setSaving(true);
        try {
            const updated = await updateSale(id, {
                customerId: selectedCustomerId || null,
                notes: editNotes || null,
                items,
            });
            if (updated) {
                // JSON round-trip to serialize Date/Decimal objects
                const serialized = JSON.parse(JSON.stringify(updated));
                setSale(serialized);
            }
            setIsEditing(false);
            showAlert('บันทึกการแก้ไขเรียบร้อย', 'success', 'สำเร็จ');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setActionLoading('delete');
        try {
            await cancelSale(id);
            const data = await fetch(`/api/sales/${id}`).then(r => r.json());
            setSale(data);
            showAlert('ยกเลิกบิลเรียบร้อย', 'success', 'สำเร็จ');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally { setActionLoading(''); setShowDelete(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!sale) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>;

    const totalAmount = isEditing
        ? items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        : Number(sale.totalAmount);
    const totalPoints = isEditing
        ? items.reduce((s, i) => s + i.points, 0)
        : sale.totalPoints;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Back */}
            <button onClick={() => router.push('/sales')} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                กลับรายการขาย
            </button>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{sale.saleNumber}</h1>
                    <p className="text-sm text-gray-500 mt-1">รายการขาย</p>
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={sale.status} className="text-sm px-3 py-1.5" />
                    {!isEditing && (
                        <>
                            <button onClick={() => window.open(`/receipt/${id}`, '_blank')}
                                className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100">
                                🧾 สลิป
                            </button>
                            <button onClick={() => window.open(`/invoice/${id}`, '_blank')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100">
                                🖨️ ใบเสร็จ A4
                            </button>
                        </>
                    )}
                    {!isEditing && sale.status !== 'CANCELLED' && user?.role === 'ADMIN' && (
                        <button onClick={startEditing} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100">
                            ✏️ แก้ไข
                        </button>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">ลูกค้า</p>
                        {isEditing ? (
                            <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                <option value="">ลูกค้าทั่วไป</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                            </select>
                        ) : (
                            <p className="text-sm font-medium text-gray-800">{sale.customer?.name || 'ลูกค้าทั่วไป'}</p>
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">มูลค่ารวม</p>
                        <p className="text-sm font-semibold text-gray-800">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">แต้มสะสม</p>
                        <p className="text-sm font-semibold text-emerald-600">+{totalPoints}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">วันที่สร้าง</p>
                        <p className="text-sm text-gray-800">{formatDateTime(sale.createdAt)}</p>
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800">รายการสินค้า ({isEditing ? items.length : sale.items.length} รายการ)</h2>
                    {isEditing && (
                        <button onClick={addItem} className="text-xs text-emerald-600 font-medium hover:underline">+ เพิ่มรายการ</button>
                    )}
                </div>

                {isEditing ? (
                    <div className="divide-y divide-gray-50">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                                    <button onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:underline">ลบ</button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs text-gray-500 mb-1 block">สินค้า</label>
                                        <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                            <option value="">-- เลือกสินค้า --</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs text-gray-500 mb-1 block">คลัง</label>
                                        <select value={item.warehouseId} onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">จำนวน</label>
                                        <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">ราคา/หน่วย</label>
                                        <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>รวม: {formatCurrency(item.quantity * item.unitPrice)}</span>
                                    <span>แต้ม: +{item.points}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">คลัง</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จำนวน</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ราคา/หน่วย</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">รวม</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">แต้ม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sale.items.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-3"><p className="text-sm font-medium text-gray-800">{item.product.name}</p><p className="text-xs text-gray-400">{item.product.code}</p></td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{item.warehouse.name}</td>
                                        <td className="px-4 py-3 text-right">
                                            <p className="text-sm font-semibold text-gray-800">{item.quantity}</p>
                                            <p className="text-xs text-gray-400">
                                                {item.unitName || item.product.unit}
                                                {item.unitName && item.unitName !== item.product.unit && (() => {
                                                    const pu = item.product.productUnits?.find(u => u.unitName === item.unitName);
                                                    return pu ? ` (×${Number(pu.conversionRate)})` : '';
                                                })()}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(item.totalPrice))}</td>
                                        <td className="px-4 py-3 text-sm text-emerald-600 text-right">+{item.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200">
                                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-800">รวมทั้งหมด</td>
                                    <td className="px-4 py-3 text-right text-lg font-bold text-emerald-600">{formatCurrency(totalAmount)}</td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">+{totalPoints}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </>
                )}
            </div>

            {/* Notes display (view mode) */}
            {!isEditing && sale.notes && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">📝 หมายเหตุ</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{sale.notes}</p>
                </div>
            )}

            {/* Notes (edit mode) */}
            {isEditing && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">📝 หมายเหตุ</label>
                    <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        rows={3}
                        placeholder="หมายเหตุสำหรับบิลนี้..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                </div>
            )}

            {/* Edit Totals + Actions */}
            {isEditing && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold text-gray-700">รวมทั้งหมด</span>
                        <div className="text-right">
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalAmount)}</p>
                            <p className="text-xs text-gray-500">แต้ม: +{totalPoints}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                            ยกเลิก
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-md shadow-blue-200 disabled:opacity-50">
                            {saving ? '💾 กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                        </button>
                    </div>
                </div>
            )}

            {/* Cancel button — hide if already cancelled */}
            {sale.status !== 'CANCELLED' && user?.role === 'ADMIN' && (
                <div className="mt-4">
                    <button onClick={() => setShowDelete(true)} disabled={actionLoading !== ''}
                        className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors">
                        {actionLoading === 'delete' ? 'กำลังยกเลิก...' : '🚫 ยกเลิกบิล'}
                    </button>
                </div>
            )}

            {/* Modals */}
            <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete}
                title="ยืนยันยกเลิกบิล" message={`ต้องการยกเลิกบิล ${sale.saleNumber} ใช่หรือไม่? ${sale.status === 'APPROVED' ? 'Stock จะถูกคืนกลับ' : ''}`}
                confirmText="ยกเลิกบิล" variant="danger" loading={actionLoading === 'delete'} />
            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
