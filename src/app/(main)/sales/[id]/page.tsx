'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { updateSale, cancelSale } from '@/app/actions/sales';
import { createSaleReturn } from '@/app/actions/sale-returns';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

interface SaleReturnData {
    id: string; returnNumber: string; reason: string | null; totalAmount: string; createdAt: string;
    createdBy: { name: string };
    items: {
        id: string; saleItemId: string; quantity: number; unitPrice: string; totalPrice: string;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

interface SaleEditLogData {
    id: string; action: string; changes: Record<string, any>; createdAt: string;
    user: { name: string };
}

interface DebtPaymentData {
    id: string; amount: string; method: string; note: string | null; paidAt: string;
}

interface SaleDetail {
    id: string; saleNumber: string; status: string;
    totalAmount: string; discount: string; totalPoints: number; createdAt: string;
    customerId: string | null;
    notes: string | null;
    paymentMethod: string | null;
    payments: { method: string; amount: number }[] | null;
    creditDueDate: string | null;
    customer: { name: string; phone: string } | null;
    createdBy: { name: string };
    items: {
        id: string; quantity: number; unitPrice: string; totalPrice: string; discount: string; points: number;
        unitName: string | null;
        productId: string; warehouseId: string;
        product: { name: string; code: string; unit: string; productUnits: { unitName: string; conversionRate: string }[] };
        warehouse: { name: string };
    }[];
    saleReturns: SaleReturnData[];
    saleEditLogs: SaleEditLogData[];
    debtPayments: DebtPaymentData[];
    debtInterests: { id: string; amount: string }[];
}

interface ProductUnitInfo { id: string; unitName: string; conversionRate: string; sellingPrice: string; isBaseUnit: boolean; }
interface Product { id: string; code: string; name: string; unit: string; price: string; pointsPerUnit: number; productStocks: { warehouseId: string; quantity: number }[]; productUnits: ProductUnitInfo[]; }
interface Warehouse { id: string; name: string; }
interface Customer { id: string; name: string; phone: string; }

interface EditItem {
    productId: string;
    warehouseId: string;
    quantity: number;
    unitPrice: number;
    points: number;
    itemDiscount: number;
    // Unit fields
    selectedUnitId: string;
    selectedUnitName: string;
    conversionRate: number;
    productUnits: ProductUnitInfo[];
}

interface ReturnItem {
    saleItemId: string;
    productId: string;
    warehouseId: string;
    productName: string;
    unit: string;
    maxQty: number;
    unitPrice: number;
    returnQty: number;
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
    const [editBillDiscount, setEditBillDiscount] = useState(0);
    const [saving, setSaving] = useState(false);

    // Reference data
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // Modals
    const [showDelete, setShowDelete] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    // Return state
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
    const [returnReason, setReturnReason] = useState('');
    const [returnSaving, setReturnSaving] = useState(false);

    const showAlert = useCallback((message: string, type: 'success' | 'error' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);

    const fetchSale = useCallback(async () => {
        const data = await fetch(`/api/sales/${id}`).then(r => r.json());
        setSale(data);
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchSale(); }, [fetchSale]);

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
        // Calculate bill-level discount = total discount - sum of item discounts
        const totalDiscount = Number(sale.discount || 0);
        const itemDiscountsSum = sale.items.reduce((s, i) => s + Number(i.discount || 0), 0);
        setEditBillDiscount(Math.max(0, totalDiscount - itemDiscountsSum));
        setItems(sale.items.map(i => {
            // Find matching product to get its productUnits
            const prod = prods.find((p: Product) => p.id === i.productId);
            const pUnits: ProductUnitInfo[] = prod?.productUnits || [];
            // Match existing unitName to a productUnit
            let selectedUnitId = '';
            let convRate = 1;
            if (i.unitName && pUnits.length > 0) {
                const matchedUnit = pUnits.find(u => u.unitName === i.unitName);
                if (matchedUnit) {
                    selectedUnitId = matchedUnit.id;
                    convRate = Number(matchedUnit.conversionRate);
                }
            }
            return {
                productId: i.productId,
                warehouseId: i.warehouseId,
                quantity: i.quantity,
                unitPrice: Number(i.unitPrice),
                points: i.points,
                itemDiscount: Number(i.discount || 0),
                selectedUnitId,
                selectedUnitName: i.unitName || prod?.unit || i.product?.unit || '',
                conversionRate: convRate,
                productUnits: pUnits,
            };
        }));
        setIsEditing(true);
    };

    const updateItem = (index: number, field: string, value: string | number) => {
        setItems(prev => {
            const copy = [...prev];
            if (field === 'productId') {
                const prod = products.find(p => p.id === value);
                const pUnits = prod?.productUnits || [];
                copy[index] = {
                    ...copy[index], productId: value as string,
                    points: (prod?.pointsPerUnit || 0) * copy[index].quantity,
                    productUnits: pUnits,
                    selectedUnitId: '',
                    selectedUnitName: prod?.unit || '',
                    conversionRate: 1,
                };
            } else if (field === 'quantity') {
                const qty = Number(value) || 0;
                const prod = products.find(p => p.id === copy[index].productId);
                const convRate = copy[index].conversionRate || 1;
                copy[index] = { ...copy[index], quantity: qty, points: (prod?.pointsPerUnit || 0) * qty * convRate };
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (copy[index] as any)[field] = (field === 'unitPrice' || field === 'itemDiscount') ? Number(value) || 0 : value;
            }
            return copy;
        });
    };

    const updateItemUnit = (index: number, unitId: string) => {
        setItems(prev => {
            const copy = [...prev];
            const item = copy[index];
            const prod = products.find(p => p.id === item.productId);

            if (unitId === '__default__') {
                // Reset to base unit
                copy[index] = {
                    ...item,
                    selectedUnitId: '',
                    selectedUnitName: prod?.unit || '',
                    conversionRate: 1,
                    unitPrice: Number(prod?.price || item.unitPrice),
                    points: (prod?.pointsPerUnit || 0) * item.quantity,
                };
            } else {
                const unit = item.productUnits.find(u => u.id === unitId);
                if (unit) {
                    const convRate = Number(unit.conversionRate);
                    copy[index] = {
                        ...item,
                        selectedUnitId: unit.id,
                        selectedUnitName: unit.unitName,
                        conversionRate: convRate,
                        unitPrice: Number(unit.sellingPrice),
                        points: (prod?.pointsPerUnit || 0) * item.quantity * convRate,
                    };
                }
            }
            return copy;
        });
    };

    const addItem = () => {
        if (warehouses.length === 0) return;
        setItems(prev => [...prev, {
            productId: '', warehouseId: warehouses[0].id, quantity: 1, unitPrice: 0, points: 0, itemDiscount: 0,
            selectedUnitId: '', selectedUnitName: '', conversionRate: 1, productUnits: [],
        }]);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (items.length === 0) { showAlert('กรุณาเพิ่มรายการสินค้า', 'error'); return; }
        if (items.some(i => !i.productId)) { showAlert('กรุณาเลือกสินค้าทุกรายการ', 'error'); return; }
        if (!user?.userId) { showAlert('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่', 'error'); return; }
        const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const totalDisc = items.reduce((s, i) => s + (i.itemDiscount || 0), 0) + editBillDiscount;
        if (totalDisc > sub) { showAlert(`ส่วนลดรวม (${totalDisc.toLocaleString()}) เกินยอดสินค้า (${sub.toLocaleString()})`, 'error'); return; }
        setSaving(true);
        try {
            const updated = await updateSale(id, {
                customerId: selectedCustomerId || null,
                notes: editNotes || null,
                items: items.map(i => ({
                    productId: i.productId,
                    warehouseId: i.warehouseId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    points: i.points,
                    itemDiscount: i.itemDiscount,
                    unitName: i.selectedUnitName || undefined,
                    conversionRate: i.conversionRate || 1,
                })),
                billDiscount: editBillDiscount,
                userId: user.userId,
            });
            if (updated) {
                // JSON round-trip to serialize Date/Decimal objects
                const serialized = JSON.parse(JSON.stringify(updated));
                setSale(serialized);
            }
            setIsEditing(false);
            showAlert('บันทึกการแก้ไขเรียบร้อย', 'success', 'สำเร็จ');
            fetchSale(); // Refresh to get updated logs
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setActionLoading('delete');
        try {
            await cancelSale(id, user?.userId);
            await fetchSale();
            showAlert('ยกเลิกบิลเรียบร้อย', 'success', 'สำเร็จ');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally { setActionLoading(''); setShowDelete(false); }
    };

    // ========== Sale Return ==========
    const openReturnModal = () => {
        if (!sale) return;

        // Calculate already-returned quantities per saleItem
        const returnedMap = new Map<string, number>();
        if (sale.saleReturns) {
            for (const sr of sale.saleReturns) {
                for (const ri of sr.items) {
                    returnedMap.set(ri.saleItemId, (returnedMap.get(ri.saleItemId) || 0) + ri.quantity);
                }
            }
        }

        const items: ReturnItem[] = sale.items
            .map(item => {
                const returned = returnedMap.get(item.id) || 0;
                const maxQty = item.quantity - returned;
                return {
                    saleItemId: item.id,
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    productName: item.product.name,
                    unit: item.unitName || item.product.unit,
                    maxQty,
                    unitPrice: Number(item.unitPrice),
                    returnQty: 0,
                };
            })
            .filter(i => i.maxQty > 0);

        if (items.length === 0) {
            showAlert('สินค้าในบิลนี้ถูกคืนครบหมดแล้ว', 'error');
            return;
        }

        setReturnItems(items);
        setReturnReason('');
        setShowReturnModal(true);
    };

    const handleReturnSubmit = async () => {
        const itemsToReturn = returnItems.filter(i => i.returnQty > 0);
        if (itemsToReturn.length === 0) { showAlert('กรุณาระบุจำนวนที่ต้องการคืน', 'error'); return; }
        if (!user?.userId) { showAlert('ไม่พบผู้ใช้งาน', 'error'); return; }

        setReturnSaving(true);
        try {
            await createSaleReturn({
                saleId: id,
                reason: returnReason || undefined,
                userId: user.userId,
                items: itemsToReturn.map(i => ({
                    saleItemId: i.saleItemId,
                    productId: i.productId,
                    warehouseId: i.warehouseId,
                    quantity: i.returnQty,
                    unitPrice: i.unitPrice,
                })),
            });
            setShowReturnModal(false);
            showAlert('คืนสินค้าเรียบร้อย', 'success', 'สำเร็จ');
            await fetchSale();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally { setReturnSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!sale) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>;

    const editSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const editItemDiscountsTotal = items.reduce((s, i) => s + (i.itemDiscount || 0), 0);
    const editTotalDiscount = editItemDiscountsTotal + editBillDiscount;
    const totalAmount = isEditing
        ? editSubtotal - editTotalDiscount
        : Number(sale.totalAmount);
    const discount = Number(sale.discount || 0);
    const subtotal = totalAmount + discount;
    const totalPoints = isEditing
        ? items.reduce((s, i) => s + i.points, 0)
        : sale.totalPoints;

    const formatEditAction = (action: string) => {
        switch (action) {
            case 'UPDATE': return { label: 'แก้ไขบิล', color: 'bg-blue-100 text-blue-700', icon: '✏️' };
            case 'CANCEL': return { label: 'ยกเลิกบิล', color: 'bg-red-100 text-red-700', icon: '🚫' };
            case 'RETURN': return { label: 'คืนสินค้า', color: 'bg-amber-100 text-amber-700', icon: '📦' };
            default: return { label: action, color: 'bg-gray-100 text-gray-700', icon: '📝' };
        }
    };

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
                <div className="flex items-center gap-2 flex-wrap justify-end">
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
                    {!isEditing && sale.status === 'APPROVED' && user?.role === 'ADMIN' && (
                        <button onClick={openReturnModal}
                            className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-sm font-medium hover:bg-orange-100">
                            📦 คืนสินค้า
                        </button>
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
                        {discount > 0 && (
                            <p className="text-xs text-red-500 mt-0.5">ส่วนลด: -{formatCurrency(discount)}</p>
                        )}
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
                                    {item.productUnits && item.productUnits.length > 0 && (
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">หน่วยขาย</label>
                                            <select value={item.selectedUnitId || '__default__'} onChange={e => updateItemUnit(idx, e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none">
                                                <option value="__default__">
                                                    {products.find(p => p.id === item.productId)?.unit || ''} (ปกติ)
                                                </option>
                                                {item.productUnits.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.unitName} (×{Number(u.conversionRate)})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
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
                                <div className="flex items-center gap-2 mt-1">
                                    <label className="text-xs text-gray-500 shrink-0">ส่วนลด (฿)</label>
                                    <input type="number" min={0} step="0.01" value={item.itemDiscount || ''}
                                        onChange={e => updateItem(idx, 'itemDiscount', e.target.value)}
                                        placeholder="0"
                                        className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-sm text-red-500 focus:ring-2 focus:ring-red-300 outline-none" />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>
                                        รวม: {formatCurrency(item.quantity * item.unitPrice)}
                                        {(item.itemDiscount || 0) > 0 && (
                                            <span className="text-red-500 ml-1">(-{formatCurrency(item.itemDiscount)})</span>
                                        )}
                                    </span>
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
                                {sale.items.map((item, idx) => {
                                    // Calculate how many of this item have been returned
                                    const returnedQty = (sale.saleReturns || []).reduce((sum, sr) =>
                                        sum + sr.items.filter(ri => ri.saleItemId === item.id).reduce((s, ri) => s + ri.quantity, 0), 0);
                                    const remainingQty = item.quantity - returnedQty;
                                    const isFullyReturned = remainingQty <= 0;
                                    const isPartiallyReturned = returnedQty > 0 && remainingQty > 0;
                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 ${isFullyReturned ? 'opacity-50 bg-gray-50' : ''}`}>
                                            <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <p className={`text-sm font-medium ${isFullyReturned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.product.name}</p>
                                                <p className="text-xs text-gray-400">{item.product.code}</p>
                                                {returnedQty > 0 && (
                                                    <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">
                                                        คืนแล้ว {returnedQty}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{item.warehouse.name}</td>
                                            <td className="px-4 py-3 text-right">
                                                <p className={`text-sm font-semibold ${isFullyReturned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                    {isPartiallyReturned ? remainingQty : item.quantity}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {item.unitName || item.product.unit}
                                                    {item.unitName && item.unitName !== item.product.unit && (() => {
                                                        const pu = item.product.productUnits?.find(u => u.unitName === item.unitName);
                                                        return pu ? ` (×${Number(pu.conversionRate)})` : '';
                                                    })()}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-right">
                                                {isFullyReturned ? (
                                                    <span className="text-gray-400 line-through">{formatCurrency(Number(item.totalPrice))}</span>
                                                ) : isPartiallyReturned ? (
                                                    <span className="text-gray-800">{formatCurrency(remainingQty * Number(item.unitPrice))}</span>
                                                ) : (
                                                    <span className="text-gray-800">{formatCurrency(Number(item.totalPrice))}</span>
                                                )}
                                                {Number(item.discount || 0) > 0 && (
                                                    <div className="text-xs text-red-500 font-normal">-{formatCurrency(Number(item.discount))}</div>
                                                )}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right ${isFullyReturned ? 'text-gray-400' : 'text-emerald-600'}`}>+{isFullyReturned ? 0 : isPartiallyReturned ? Math.round(item.points * remainingQty / item.quantity) : item.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                {discount > 0 && (<>
                                    <tr className="border-t border-gray-200">
                                        <td colSpan={5} className="px-4 py-2 text-right text-sm text-gray-600">ยอดรวมก่อนส่วนลด</td>
                                        <td className="px-4 py-2 text-right text-sm text-gray-600">{formatCurrency(subtotal)}</td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={5} className="px-4 py-2 text-right text-sm text-red-500 font-medium">ส่วนลด</td>
                                        <td className="px-4 py-2 text-right text-sm text-red-500 font-medium">-{formatCurrency(discount)}</td>
                                        <td></td>
                                    </tr>
                                </>)}
                                <tr className="border-t-2 border-gray-200">
                                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-800">รวมทั้งสิ้น</td>
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

            {/* ========== Payment Details ========== */}
            {!isEditing && sale.paymentMethod && (() => {
                const paymentMethodLabels: Record<string, string> = {
                    'CASH': '💵 เงินสด', 'TRANSFER': '🏦 โอน', 'CREDIT': '📋 เครดิต',
                    'SPLIT': '🔀 จ่ายหลายช่องทาง', 'CREDIT_CARD': '💳 บัตรเครดิต',
                };
                const payments = (sale.payments && Array.isArray(sale.payments) ? sale.payments : []) as { method: string; amount: number }[];
                const hasCredit = sale.paymentMethod === 'CREDIT' || sale.paymentMethod === 'SPLIT';
                const totalInterest = (sale.debtInterests || []).reduce((s, di) => s + Number(di.amount), 0);
                const grandTotal = Number(sale.totalAmount) + totalInterest;

                // Initial non-credit paid
                let initialPaid = 0;
                for (const p of payments) {
                    if (p.method !== 'CREDIT') initialPaid += Number(p.amount);
                }
                // Subsequent debt payments
                const debtPaid = (sale.debtPayments || [])
                    .filter(dp => dp.method !== 'CREDIT')
                    .reduce((s, dp) => s + Number(dp.amount), 0);
                const totalPaid = initialPaid + debtPaid;
                const remaining = Math.max(0, grandTotal - totalPaid);
                const paidPercent = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0;

                return (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-6">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            💳 ข้อมูลการชำระเงิน
                        </h2>

                        {/* Payment Method + Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div>
                                <p className="text-xs text-gray-500">ช่องทางชำระ</p>
                                <p className="text-sm font-medium text-gray-800 mt-0.5">
                                    {paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod}
                                </p>
                            </div>
                            {hasCredit && sale.creditDueDate && (
                                <div>
                                    <p className="text-xs text-gray-500">กำหนดชำระ</p>
                                    <p className={`text-sm font-medium mt-0.5 ${new Date(sale.creditDueDate) < new Date() && remaining > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                        {new Date(sale.creditDueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {new Date(sale.creditDueDate) < new Date() && remaining > 0 && <span className="ml-1">⚠️</span>}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-gray-500">จ่ายแล้ว</p>
                                <p className="text-sm font-semibold text-emerald-600 mt-0.5">{formatCurrency(totalPaid)}</p>
                            </div>
                            {hasCredit && (
                                <div>
                                    <p className="text-xs text-gray-500">ค้างจ่าย</p>
                                    <p className={`text-sm font-semibold mt-0.5 ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {remaining > 0 ? formatCurrency(remaining) : '✅ ชำระครบแล้ว'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Progress bar for credit/split */}
                        {hasCredit && remaining > 0 && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>ความคืบหน้าการชำระ</span>
                                    <span>{paidPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${paidPercent}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Payment split details */}
                        {payments.length > 0 && (
                            <div className="border-t border-gray-100 pt-3 mb-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">รายละเอียดการชำระ (ตอนขาย)</p>
                                <div className="space-y-1.5">
                                    {payments.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">
                                                {paymentMethodLabels[p.method] || p.method}
                                            </span>
                                            <span className={`font-medium ${p.method === 'CREDIT' ? 'text-orange-600' : 'text-gray-800'}`}>
                                                {formatCurrency(Number(p.amount))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Debt payments history */}
                        {sale.debtPayments && sale.debtPayments.length > 0 && (
                            <div className="border-t border-gray-100 pt-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">ประวัติชำระหนี้</p>
                                <div className="space-y-2">
                                    {sale.debtPayments.map(dp => (
                                        <div key={dp.id} className="flex justify-between items-center text-sm bg-emerald-50 rounded-lg px-3 py-2">
                                            <div>
                                                <span className="text-gray-700 font-medium">
                                                    {paymentMethodLabels[dp.method] || dp.method}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-2">
                                                    {new Date(dp.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {dp.note && <span className="text-xs text-gray-400 ml-2">({dp.note})</span>}
                                            </div>
                                            <span className="font-semibold text-emerald-600">+{formatCurrency(Number(dp.amount))}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Interest */}
                        {totalInterest > 0 && (
                            <div className="border-t border-gray-100 pt-3 mt-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">ดอกเบี้ยสะสม</span>
                                    <span className="font-medium text-red-600">{formatCurrency(totalInterest)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

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
                    {/* Bill-level discount */}
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                        <label className="text-sm text-gray-600 shrink-0">🏷️ ส่วนลดทั้งบิล</label>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">฿</span>
                            <input type="number" min={0} step="0.01" value={editBillDiscount || ''}
                                onChange={e => setEditBillDiscount(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-red-500 font-medium focus:ring-2 focus:ring-red-300 outline-none text-right" />
                        </div>
                    </div>

                    {/* Totals breakdown */}
                    <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>ยอดรวมสินค้า</span>
                            <span>{formatCurrency(editSubtotal)}</span>
                        </div>
                        {editItemDiscountsTotal > 0 && (
                            <div className="flex justify-between text-sm text-red-500">
                                <span>ส่วนลดรายสินค้า</span>
                                <span>-{formatCurrency(editItemDiscountsTotal)}</span>
                            </div>
                        )}
                        {editBillDiscount > 0 && (
                            <div className="flex justify-between text-sm text-red-500">
                                <span>ส่วนลดทั้งบิล</span>
                                <span>-{formatCurrency(editBillDiscount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                            <span className="text-gray-800">รวมทั้งสิ้น</span>
                            <span className="text-emerald-600">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="text-xs text-gray-500 text-right">แต้ม: +{totalPoints}</div>
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

            {/* ========== Sale Returns History ========== */}
            {!isEditing && sale.saleReturns && sale.saleReturns.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">📦 ประวัติคืนสินค้า ({sale.saleReturns.length} ครั้ง)</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {sale.saleReturns.map(sr => (
                            <div key={sr.id} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-orange-600">{sr.returnNumber}</span>
                                        <span className="text-xs text-gray-400">{formatDateTime(sr.createdAt)}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-orange-600">{formatCurrency(Number(sr.totalAmount))}</span>
                                </div>
                                {sr.reason && <p className="text-xs text-gray-500 mb-2">เหตุผล: {sr.reason}</p>}
                                <div className="space-y-1">
                                    {sr.items.map(ri => (
                                        <div key={ri.id} className="flex justify-between text-xs text-gray-600">
                                            <span>{ri.product.name} ({ri.product.code})</span>
                                            <span>คืน {ri.quantity} {ri.product.unit} × {formatCurrency(Number(ri.unitPrice))}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">โดย {sr.createdBy.name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========== Edit History ========== */}
            {!isEditing && sale.saleEditLogs && sale.saleEditLogs.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">📋 ประวัติการเปลี่ยนแปลง ({sale.saleEditLogs.length} รายการ)</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {sale.saleEditLogs.map(log => {
                            const actionInfo = formatEditAction(log.action);
                            return (
                                <div key={log.id} className="p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionInfo.color}`}>
                                                {actionInfo.icon} {actionInfo.label}
                                            </span>
                                            <span className="text-xs text-gray-400">{log.user.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
                                    </div>
                                    {log.action === 'UPDATE' && log.changes && (
                                        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                                            {log.changes.totalAmount && (
                                                <p>ยอดรวม: {formatCurrency(log.changes.totalAmount.old)} → {formatCurrency(log.changes.totalAmount.new)}</p>
                                            )}
                                            {log.changes.discount && (
                                                <p>ส่วนลด: {formatCurrency(log.changes.discount.old)} → {formatCurrency(log.changes.discount.new)}</p>
                                            )}
                                        </div>
                                    )}
                                    {log.action === 'RETURN' && log.changes && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            <p>ใบคืน: {log.changes.returnNumber} | ยอดคืน: {formatCurrency(log.changes.totalAmount)}</p>
                                        </div>
                                    )}
                                    {log.action === 'CANCEL' && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            <p>ยกเลิกจากสถานะ: {log.changes?.previousStatus || '-'}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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

            {/* ========== Return Modal ========== */}
            {showReturnModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800">📦 คืนสินค้า</h3>
                            <p className="text-sm text-gray-500 mt-1">เลือกสินค้าที่ต้องการคืนและระบุจำนวน</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {returnItems.map((item, idx) => (
                                <div key={item.saleItemId} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                                        <p className="text-xs text-gray-400">คืนได้สูงสุด {item.maxQty} {item.unit} | ราคา {formatCurrency(item.unitPrice)}/{item.unit}</p>
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        max={item.maxQty}
                                        value={item.returnQty || ''}
                                        onChange={e => {
                                            const val = Math.min(Number(e.target.value) || 0, item.maxQty);
                                            setReturnItems(prev => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], returnQty: val };
                                                return copy;
                                            });
                                        }}
                                        placeholder="0"
                                        className="w-20 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center focus:ring-2 focus:ring-orange-400 outline-none"
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="text-sm text-gray-600 mb-1 block">เหตุผลการคืน (ไม่บังคับ)</label>
                                <textarea
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    rows={2}
                                    placeholder="เช่น สินค้าชำรุด, สั่งผิด..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                                />
                            </div>

                            {/* Return total */}
                            {returnItems.some(i => i.returnQty > 0) && (
                                <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 border border-orange-100">
                                    <span className="text-sm font-medium text-orange-700">ยอดคืนรวม</span>
                                    <span className="text-lg font-bold text-orange-600">
                                        {formatCurrency(returnItems.reduce((s, i) => s + i.returnQty * i.unitPrice, 0))}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setShowReturnModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                                ยกเลิก
                            </button>
                            <button onClick={handleReturnSubmit} disabled={returnSaving || !returnItems.some(i => i.returnQty > 0)}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 shadow-md shadow-orange-200 disabled:opacity-50">
                                {returnSaving ? '⏳ กำลังบันทึก...' : '📦 ยืนยันคืนสินค้า'}
                            </button>
                        </div>
                    </div>
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
