'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateVendor, deleteVendor } from '@/app/actions/vendors';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface Vendor {
    id: string;
    name: string;
    phone: string | null;
    lineId: string | null;
    address: string | null;
    isActive: boolean;
    _count: { goodsReceives: number };
}

export default function VendorCard({ v }: { v: Vendor }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(v.name);
    const [phone, setPhone] = useState(v.phone || '');
    const [lineId, setLineId] = useState(v.lineId || '');
    const [address, setAddress] = useState(v.address || '');
    const [isActive, setIsActive] = useState(v.isActive);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const handleSave = async () => {
        if (!name.trim()) {
            setAlertModal({ open: true, message: 'กรุณาระบุชื่อผู้ขาย', type: 'warning', title: 'ข้อมูลไม่ครบ' });
            return;
        }
        setSaving(true);
        try {
            await updateVendor(v.id, {
                name: name.trim(),
                phone: phone.trim() || undefined,
                lineId: lineId.trim() || undefined,
                address: address.trim() || undefined,
                isActive,
            });
            setAlertModal({ open: true, message: 'บันทึกเรียบร้อย', type: 'success', title: 'สำเร็จ' });
            setEditing(false);
            router.refresh();
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteVendor(v.id);
            router.refresh();
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    const handleCancel = () => {
        setName(v.name);
        setPhone(v.phone || '');
        setLineId(v.lineId || '');
        setAddress(v.address || '');
        setIsActive(v.isActive);
        setEditing(false);
    };

    return (
        <div className={`bg-white rounded-xl shadow-md border ${editing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'} p-5 hover:shadow-lg transition-shadow`}>
            {editing ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ชื่อผู้ขาย *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">LINE ID</label>
                            <input type="text" value={lineId} onChange={e => setLineId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ที่อยู่</label>
                        <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id={`active-${v.id}`} checked={isActive} onChange={e => setIsActive(e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                        <label htmlFor={`active-${v.id}`} className="text-sm text-gray-600">เปิดใช้งาน</label>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                        </button>
                        <button onClick={handleCancel}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                            ยกเลิก
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg">
                                🏢
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">{v.name}</h3>
                                {v.phone && <p className="text-xs text-gray-400">📞 {v.phone}</p>}
                            </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${v.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {v.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                    </div>

                    {v.lineId && (
                        <p className="text-xs text-gray-500 mb-1">💬 LINE: {v.lineId}</p>
                    )}
                    {v.address && (
                        <p className="text-xs text-gray-500 mb-2">📍 {v.address}</p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                        <span className="text-xs text-gray-400">นำเข้าสินค้า {v._count.goodsReceives} ครั้ง</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => setEditing(true)}
                            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                            ✏️ แก้ไข
                        </button>
                        <button onClick={() => setConfirmDelete(true)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                            🗑️ ลบ
                        </button>
                    </div>
                </>
            )}

            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))} message={alertModal.message} type={alertModal.type} title={alertModal.title} />
            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title="ยืนยันการลบ"
                message={`ต้องการลบผู้ขาย "${v.name}" หรือไม่?`}
                variant="danger"
                confirmText="ลบ"
            />
        </div>
    );
}
