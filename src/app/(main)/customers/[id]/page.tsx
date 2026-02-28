'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { updateCustomer, redeemPoints } from '@/app/actions/customers';
import StatusBadge from '@/components/StatusBadge';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';
import Link from 'next/link';

interface PointTransaction {
    id: string; type: string; points: number; description: string | null; createdAt: string;
}
interface SaleItem {
    id: string; quantity: number; unitPrice: string; points: number;
    product: { name: string; code: string }; warehouse: { name: string };
}
interface Sale {
    id: string; saleNumber: string; status: string; totalAmount: string;
    totalPoints: number; createdAt: string; items: SaleItem[];
}
interface CustomerGroup { id: string; name: string; }
interface Customer {
    id: string; name: string; phone: string; totalPoints: number; createdAt: string;
    address: string | null; taxId: string | null;
    customerGroup: { id: string; name: string };
    pointTransactions: PointTransaction[];
    sales: Sale[];
}

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [tab, setTab] = useState<'sales' | 'points'>('sales');
    const [groups, setGroups] = useState<CustomerGroup[]>([]);

    // Edit state
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editGroupId, setEditGroupId] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editTaxId, setEditTaxId] = useState('');
    const [saving, setSaving] = useState(false);

    // Redeem state
    const [showRedeem, setShowRedeem] = useState(false);
    const [redeemPts, setRedeemPts] = useState<number>(0);
    const [redeemNote, setRedeemNote] = useState('');
    const [redeeming, setRedeeming] = useState(false);

    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    const loadCustomer = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const res = await fetch(`/api/customers/${id}?${params}`);
        if (res.ok) setCustomer(await res.json());
        setLoading(false);
    }, [id, from, to]);

    useEffect(() => { loadCustomer(); }, [loadCustomer]);
    useEffect(() => {
        fetch('/api/customer-groups').then(r => r.json()).then(setGroups);
    }, []);

    const startEditing = () => {
        if (!customer) return;
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditGroupId(customer.customerGroup.id);
        setEditAddress(customer.address || '');
        setEditTaxId(customer.taxId || '');
        setEditing(true);
    };

    const handleSave = async () => {
        if (!editName.trim() || !editPhone.trim()) {
            setAlertModal({ open: true, message: 'กรุณากรอกชื่อและเบอร์โทร', type: 'error', title: 'ข้อมูลไม่ครบ' });
            return;
        }
        setSaving(true);
        try {
            await updateCustomer(id, { name: editName.trim(), phone: editPhone.trim(), customerGroupId: editGroupId, address: editAddress.trim(), taxId: editTaxId.trim() });
            setEditing(false);
            await loadCustomer();
            setAlertModal({ open: true, message: 'บันทึกข้อมูลเรียบร้อย', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setSaving(false); }
    };

    const handleRedeem = async () => {
        setRedeeming(true);
        try {
            await redeemPoints(id, redeemPts, redeemNote);
            setShowRedeem(false);
            setRedeemPts(0);
            setRedeemNote('');
            await loadCustomer();
            setAlertModal({ open: true, message: `แลกแต้มสำเร็จ ${redeemPts} แต้ม`, type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setRedeeming(false); }
    };

    if (loading && !customer) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (!customer) return <div className="text-center py-12 text-gray-400">ไม่พบข้อมูลลูกค้า</div>;

    const totalPurchaseAmount = customer.sales
        .filter(s => s.status === 'APPROVED')
        .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalEarnedPoints = customer.pointTransactions
        .filter(pt => pt.type === 'EARN')
        .reduce((sum, pt) => sum + pt.points, 0);

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← กลับ</Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{customer.name}</h1>
                        <p className="text-sm text-gray-500">รายละเอียดลูกค้า</p>
                    </div>
                </div>
                {!editing && (
                    <button onClick={startEditing}
                        className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        ✏️ แก้ไขข้อมูล
                    </button>
                )}
            </div>

            {/* Customer Info Card — Editable */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
                {editing ? (
                    <div className="space-y-4">
                        <h2 className="font-semibold text-gray-800">แก้ไขข้อมูลลูกค้า</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">ชื่อ</label>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">เบอร์โทร</label>
                                <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">กลุ่มลูกค้า</label>
                                <select value={editGroupId} onChange={e => setEditGroupId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                                    <option value="" disabled>-- เลือกกลุ่มลูกค้า --</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">ที่อยู่</label>
                                <textarea value={editAddress} onChange={e => setEditAddress(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows={2} placeholder="ที่อยู่สำหรับออกใบกำกับ" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">เลขประจำตัวผู้เสียภาษี</label>
                                <input type="text" value={editTaxId} onChange={e => setEditTaxId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="เลข 13 หลัก" />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50">ยกเลิก</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">เบอร์โทร</p>
                            <p className="text-sm font-semibold text-gray-800">{customer.phone}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">กลุ่ม</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">{customer.customerGroup.name}</span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">แต้มสะสม</p>
                            <p className="text-lg font-bold text-emerald-600">{customer.totalPoints.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">ยอดซื้อรวม</p>
                            <p className="text-lg font-bold text-gray-800">{formatCurrency(totalPurchaseAmount)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">เลขผู้เสียภาษี</p>
                            <p className="text-sm font-semibold text-gray-800">{customer.taxId || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">สมัครเมื่อ</p>
                            <p className="text-sm font-semibold text-gray-800">{formatDate(customer.createdAt)}</p>
                        </div>
                        {customer.address && (
                            <div className="col-span-2 sm:col-span-6">
                                <p className="text-xs text-gray-400 mb-1">ที่อยู่</p>
                                <p className="text-sm text-gray-800">{customer.address}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Redeem Points Button */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button onClick={() => setShowRedeem(true)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-200">
                    🎁 แลกแต้ม ({customer.totalPoints.toLocaleString()} แต้ม)
                </button>
            </div>

            {/* Redeem Modal */}
            <ConfirmModal
                isOpen={showRedeem}
                onClose={() => { setShowRedeem(false); setRedeemPts(0); setRedeemNote(''); }}
                onConfirm={handleRedeem}
                title="แลกแต้ม"
                message=""
                confirmText={redeeming ? 'กำลังดำเนินการ...' : 'ยืนยันแลกแต้ม'}
                variant="primary"
                loading={redeeming}
            >
                <div className="space-y-4 py-2">
                    <div className="text-center">
                        <p className="text-sm text-gray-500">แต้มคงเหลือ</p>
                        <p className="text-3xl font-bold text-emerald-600">{customer.totalPoints.toLocaleString()}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">จำนวนแต้มที่ต้องการแลก <span className="text-red-400">*</span></label>
                        <input type="number" value={redeemPts || ''} onChange={e => setRedeemPts(parseInt(e.target.value) || 0)}
                            max={customer.totalPoints} min={1}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="0" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">หมายเหตุ (ของรางวัล/ส่วนลด) <span className="text-red-400">*</span></label>
                        <textarea value={redeemNote} onChange={e => setRedeemNote(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                            placeholder="เช่น แลกส่วนลด 100 บาท, แลกปุ๋ย 1 ถุง..." />
                    </div>
                </div>
            </ConfirmModal>

            {/* Date Range Filter */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-500">📅 ช่วงเวลา:</span>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-400">ถึง</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    {(from || to) && (
                        <button onClick={() => { setFrom(''); setTo(''); }}
                            className="text-xs text-red-400 hover:text-red-600">✕ ล้าง</button>
                    )}
                </div>
                {(from || to) && (
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                        <span>ยอดซื้อช่วงนี้: <b className="text-gray-800">{formatCurrency(totalPurchaseAmount)}</b></span>
                        <span>แต้มได้รับ: <b className="text-emerald-600">+{totalEarnedPoints}</b></span>
                        <span>จำนวนบิล: <b className="text-gray-800">{customer.sales.length}</b></span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
                <button onClick={() => setTab('sales')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'sales' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>
                    📦 ประวัติการซื้อ ({customer.sales.length})
                </button>
                <button onClick={() => setTab('points')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'points' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>
                    ⭐ ประวัติแต้ม ({customer.pointTransactions.length})
                </button>
            </div>

            {/* Tab Content */}
            {tab === 'sales' ? (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    {customer.sales.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">ไม่มีรายการในช่วงนี้</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {customer.sales.map(sale => (
                                <Link key={sale.id} href={`/sales/${sale.id}`}
                                    className="block p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-800">{sale.saleNumber}</span>
                                            <StatusBadge status={sale.status} />
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{formatCurrency(Number(sale.totalAmount))}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span>{formatDate(sale.createdAt)}</span>
                                        {sale.totalPoints > 0 && (
                                            <span className="text-emerald-600 font-medium">+{sale.totalPoints} แต้ม</span>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {sale.items.map(item => (
                                            <span key={item.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                                {item.product.name} ×{item.quantity}
                                            </span>
                                        ))}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    {customer.pointTransactions.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">ไม่มีรายการในช่วงนี้</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {customer.pointTransactions.map(pt => (
                                <div key={pt.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                                    <div>
                                        <p className="text-sm text-gray-800 font-medium">
                                            {pt.type === 'EARN' ? '✅ ได้รับแต้ม' : '🎁 แลกแต้ม'}
                                        </p>
                                        {pt.description && <p className="text-xs text-gray-600 mt-0.5">📝 {pt.description}</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(pt.createdAt)}</p>
                                    </div>
                                    <span className={`text-lg font-bold ${pt.type === 'EARN' ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {pt.type === 'EARN' ? '+' : '-'}{pt.points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
