'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { updateGoodsReceive, approveGoodsReceive, rejectGoodsReceive, deleteGoodsReceive, updateGoodsReceivePayment } from '@/app/actions/goods-receive';
import StatusBadge from '@/components/StatusBadge';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Vendor { id: string; name: string; phone: string | null; lineId: string | null }
interface Product { id: string; name: string; code: string; unit: string }
interface Warehouse { id: string; name: string }

interface GRItem {
    id?: string;
    productId: string;
    productName: string;
    productCode: string;
    productUnit: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    unitCost: number;
    lotNo: string;
}

interface GRDetail {
    id: string;
    grNumber: string;
    poNumber: string | null;
    vendorId: string;
    status: string;
    totalAmount: number | string;
    notes: string | null;
    receivedDate: string;
    createdAt: string;
    goodsPaid: boolean;
    shippingPaid: boolean;
    shippingCost: number | string;
    vendor: Vendor;
    createdBy: { name: string };
    items: {
        id: string;
        productId: string;
        warehouseId: string;
        quantity: number;
        unitCost: number | string;
        totalCost: number | string;
        lotNo: string | null;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

export default function GoodsReceiveDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [gr, setGr] = useState<GRDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState('');

    // Editable fields
    const [vendorId, setVendorId] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [receivedDate, setReceivedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<GRItem[]>([]);

    // Payment tracking
    const [goodsPaid, setGoodsPaid] = useState(false);
    const [shippingPaid, setShippingPaid] = useState(false);
    const [shippingCost, setShippingCost] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);

    // Lookup data
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    // Modals
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);

    const isPending = gr?.status === 'PENDING';

    // Fetch GR data
    useEffect(() => {
        fetch(`/api/goods-receive/${id}`)
            .then(r => r.json())
            .then((data: GRDetail) => {
                setGr(data);
                setVendorId(data.vendorId);
                setPoNumber(data.poNumber || '');
                setReceivedDate(data.receivedDate ? new Date(data.receivedDate).toISOString().split('T')[0] : '');
                setNotes(data.notes || '');
                setItems(data.items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    productName: item.product.name,
                    productCode: item.product.code,
                    productUnit: item.product.unit,
                    warehouseId: item.warehouseId,
                    warehouseName: item.warehouse.name,
                    quantity: item.quantity,
                    unitCost: Number(item.unitCost),
                    lotNo: item.lotNo || '',
                })));
                setGoodsPaid(data.goodsPaid || false);
                setShippingPaid(data.shippingPaid || false);
                setShippingCost(Number(data.shippingCost) ? String(Number(data.shippingCost)) : '');
                setLoading(false);
            });
    }, [id]);

    // Fetch lookup data
    useEffect(() => {
        if (!isPending) return;
        Promise.all([
            fetch('/api/vendors').then(r => r.json()),
            fetch('/api/products').then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
        ]).then(([v, p, w]) => {
            setVendors(v);
            setProducts(p);
            setWarehouses(w);
        });
    }, [isPending]);

    // Item helpers
    const addItem = () => {
        setItems([...items, { productId: '', productName: '', productCode: '', productUnit: '', warehouseId: warehouses[0]?.id || '', warehouseName: warehouses[0]?.name || '', quantity: 1, unitCost: 0, lotNo: '' }]);
    };

    const removeItem = (idx: number) => {
        if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
    };

    const updateItem = (idx: number, field: string, value: string | number) => {
        const newItems = [...items];
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            newItems[idx] = { ...newItems[idx], productId: value as string, productName: product?.name || '', productCode: product?.code || '', productUnit: product?.unit || '' };
        } else if (field === 'warehouseId') {
            const wh = warehouses.find(w => w.id === value);
            newItems[idx] = { ...newItems[idx], warehouseId: value as string, warehouseName: wh?.name || '' };
        } else {
            newItems[idx] = { ...newItems[idx], [field]: value };
        }
        setItems(newItems);
    };

    const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

    // Save changes
    const handleSave = async () => {
        if (!vendorId) { showAlert('กรุณาเลือกผู้ขาย', 'warning', 'ข้อมูลไม่ครบ'); return; }
        const validItems = items.filter(i => i.productId && i.warehouseId && i.quantity > 0);
        if (validItems.length === 0) { showAlert('กรุณาเพิ่มรายการสินค้า', 'warning', 'ข้อมูลไม่ครบ'); return; }

        setSaving(true);
        try {
            const updated = await updateGoodsReceive(id, {
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
            });
            if (updated) {
                const serialized = JSON.parse(JSON.stringify(updated));
                setGr(serialized);
            }
            showAlert('บันทึกการแก้ไขเรียบร้อย', 'success', 'สำเร็จ');
        } catch (error) {
            showAlert((error as Error).message || 'ไม่สามารถบันทึกได้', 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    // Approve
    const handleApprove = async () => {
        setActionLoading('approve');
        try {
            await approveGoodsReceive(id);
            router.push('/goods-receive');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setActionLoading('');
            setShowApprove(false);
        }
    };

    // Reject
    const handleReject = async () => {
        setActionLoading('reject');
        try {
            await rejectGoodsReceive(id);
            router.push('/goods-receive');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setActionLoading('');
            setShowReject(false);
        }
    };

    // Delete
    const handleDelete = async () => {
        setActionLoading('delete');
        try {
            await deleteGoodsReceive(id);
            router.push('/goods-receive');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setActionLoading('');
            setShowDelete(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!gr) return null;

    const selectedVendor = vendors.find(v => v.id === vendorId) || gr.vendor;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{gr.grNumber}</h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        สร้างโดย {gr.createdBy.name} • {formatDate(gr.createdAt)}
                    </p>
                </div>
                <StatusBadge status={gr.status} />
            </div>

            {/* Vendor & Header Info */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">ข้อมูลเอกสาร</h2>
                {isPending ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">ผู้ขาย</label>
                            <select
                                value={vendorId}
                                onChange={e => setVendorId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            >
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">เลขที่ PO</label>
                            <input
                                type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)}
                                placeholder="PO-xxxx"
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">วันที่รับสินค้า</label>
                            <input
                                type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">หมายเหตุ</label>
                            <input
                                type="text" value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="หมายเหตุ (ถ้ามี)"
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                            <p className="text-xs text-gray-400">ชื่อผู้ขาย</p>
                            <p className="text-sm font-medium text-gray-800">{gr.vendor.name}</p>
                        </div>
                        {gr.poNumber && (
                            <div>
                                <p className="text-xs text-gray-400">เลขที่ PO</p>
                                <p className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-lg inline-block">{gr.poNumber}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-400">วันที่รับ</p>
                            <p className="text-sm text-gray-800">{formatDate(gr.receivedDate)}</p>
                        </div>
                        {gr.notes && (
                            <div>
                                <p className="text-xs text-gray-400">หมายเหตุ</p>
                                <p className="text-sm text-gray-800">{gr.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Vendor contact info */}
                {selectedVendor && (selectedVendor.phone || selectedVendor.lineId) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 flex-wrap">
                        {selectedVendor.phone && (
                            <span className="text-xs text-gray-500">📞 {selectedVendor.phone}</span>
                        )}
                        {selectedVendor.lineId && (
                            <span className="text-xs text-gray-500">💬 LINE: {selectedVendor.lineId}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Items Section */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-4 sm:mb-6">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">รายการสินค้า ({items.length})</h2>
                    {isPending && (
                        <button onClick={addItem} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                            <span className="text-lg leading-none">+</span> เพิ่มรายการ
                        </button>
                    )}
                </div>

                {isPending ? (
                    /* Editable Items */
                    <div className="divide-y divide-gray-50">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-4 sm:px-6">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                    {/* Product */}
                                    <div className="sm:col-span-4">
                                        <label className="text-xs text-gray-400 mb-1 block">สินค้า</label>
                                        <select
                                            value={item.productId}
                                            onChange={e => updateItem(idx, 'productId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="">เลือกสินค้า</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                                        </select>
                                    </div>
                                    {/* Warehouse */}
                                    <div className="sm:col-span-3">
                                        <label className="text-xs text-gray-400 mb-1 block">คลัง</label>
                                        <select
                                            value={item.warehouseId}
                                            onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    {/* Qty */}
                                    <div className="sm:col-span-2">
                                        <label className="text-xs text-gray-400 mb-1 block">จำนวน</label>
                                        <input
                                            type="number" min={1} value={item.quantity}
                                            onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    {/* Unit Cost */}
                                    <div className="sm:col-span-2">
                                        <label className="text-xs text-gray-400 mb-1 block">ต้นทุน/หน่วย</label>
                                        <input
                                            type="number" min={0} step="0.01" value={item.unitCost}
                                            onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    {/* Remove */}
                                    <div className="sm:col-span-1 flex items-end justify-end sm:justify-center">
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบรายการ">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    {/* Lot No */}
                                    <div className="sm:col-span-4">
                                        <label className="text-xs text-gray-400 mb-1 block">Lot No.</label>
                                        <input
                                            type="text" value={item.lotNo}
                                            onChange={e => updateItem(idx, 'lotNo', e.target.value)}
                                            placeholder="เลข Lot (ถ้ามี)"
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                                {/* Line total */}
                                <div className="text-right mt-2">
                                    <span className="text-xs text-gray-400">รวม: </span>
                                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(item.quantity * item.unitCost)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Read-only Items Table */
                    <>
                        {/* Desktop */}
                        <table className="hidden sm:table w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">สินค้า</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">คลัง</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Lot No.</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">จำนวน</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">ต้นทุน/หน่วย</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">รวม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {gr.items.map(item => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                                            <p className="text-xs text-gray-400">{item.product.code}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{item.warehouse.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{item.lotNo || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800 text-right">{item.quantity} {item.product.unit}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800 text-right">{formatCurrency(Number(item.unitCost))}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(item.totalCost))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Mobile */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {gr.items.map(item => (
                                <div key={item.id} className="p-4">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                                            <p className="text-xs text-gray-400">{item.product.code} · {item.warehouse.name}{item.lotNo ? ` · Lot: ${item.lotNo}` : ''}</p>
                                        </div>
                                        <p className="text-sm font-bold text-gray-800">{formatCurrency(Number(item.totalCost))}</p>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>{item.quantity} {item.product.unit}</span>
                                        <span>@ {formatCurrency(Number(item.unitCost))}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Total */}
                <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-600">มูลค่ารวม</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(isPending ? total : Number(gr.totalAmount))}</span>
                </div>
            </div>

            {/* Payment Tracking */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">💰 สถานะการจ่ายเงิน</h2>
                    <button
                        onClick={async () => {
                            setPaymentSaving(true);
                            try {
                                await updateGoodsReceivePayment(id, { goodsPaid, shippingPaid, shippingCost: parseFloat(shippingCost) || 0 });
                                showAlert('บันทึกสถานะการจ่ายเงินเรียบร้อย', 'success', 'สำเร็จ');
                            } catch (error) {
                                showAlert((error as Error).message || 'ไม่สามารถบันทึกได้', 'error', 'เกิดข้อผิดพลาด');
                            }
                            setPaymentSaving(false);
                        }}
                        disabled={paymentSaving}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                        {paymentSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                    </button>
                </div>
                <div className="space-y-4">
                    {/* ค่าสินค้า */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={goodsPaid}
                            onChange={(e) => setGoodsPaid(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1">
                            <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-600 transition-colors">จ่ายค่าสินค้าแล้ว</span>
                            <p className="text-xs text-gray-400">มูลค่า {formatCurrency(isPending ? total : Number(gr.totalAmount))}</p>
                        </div>
                        {goodsPaid && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">✓ จ่ายแล้ว</span>}
                    </label>

                    {/* ค่ารถบรรทุก */}
                    <div className="border-t border-gray-100 pt-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={shippingPaid}
                                onChange={(e) => setShippingPaid(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-600 transition-colors">จ่ายค่ารถบรรทุกสินค้าแล้ว</span>
                            {shippingPaid && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">✓ จ่ายแล้ว</span>}
                        </label>
                        <div className="mt-3 ml-8">
                            <label className="text-xs text-gray-500 mb-1 block">ยอดค่ารถบรรทุก (บาท)</label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={shippingCost}
                                onChange={(e) => setShippingCost(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-48 px-3 py-2 rounded-xl border border-gray-200 text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {isPending && (
                <div className="space-y-3">
                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm shadow-md shadow-blue-200 disabled:opacity-50 transition-colors"
                    >
                        {saving ? '💾 กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                    </button>

                    {/* Approve / Reject buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowReject(true)}
                            disabled={actionLoading !== ''}
                            className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 disabled:opacity-50"
                        >
                            {actionLoading === 'reject' ? 'กำลังดำเนินการ...' : '❌ ปฏิเสธ'}
                        </button>
                        <button
                            onClick={() => setShowApprove(true)}
                            disabled={actionLoading !== ''}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                        >
                            {actionLoading === 'approve' ? 'กำลังดำเนินการ...' : '✅ อนุมัติรับสินค้า'}
                        </button>
                    </div>
                </div>
            )}

            {/* Delete button - only visible if not approved */}
            {gr.status !== 'APPROVED' && (
            <div className="mt-4">
                <button
                    onClick={() => setShowDelete(true)}
                    disabled={actionLoading !== ''}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                    {actionLoading === 'delete' ? 'กำลังลบ...' : '🗑️ ลบรายการ'}
                </button>
            </div>
            )}

            {/* Modals */}
            <ConfirmModal
                isOpen={showApprove}
                onClose={() => setShowApprove(false)}
                onConfirm={handleApprove}
                title="ยืนยันรับสินค้าเข้าคลัง"
                message="สินค้าจะถูกเพิ่มเข้า Stock ทันที ยืนยันดำเนินการ?"
                confirmText="อนุมัติ"
                variant="success"
                loading={actionLoading === 'approve'}
            />
            <ConfirmModal
                isOpen={showReject}
                onClose={() => setShowReject(false)}
                onConfirm={handleReject}
                title="ยืนยันปฏิเสธการรับสินค้า"
                message="ยืนยันปฏิเสธรายการรับสินค้านี้?"
                confirmText="ปฏิเสธ"
                variant="danger"
                loading={actionLoading === 'reject'}
            />
            <ConfirmModal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                onConfirm={handleDelete}
                title="ยืนยันลบรายการรับสินค้า"
                message={`ต้องการลบ ${gr.grNumber} ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
                confirmText="ลบ"
                variant="danger"
                loading={actionLoading === 'delete'}
            />
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
