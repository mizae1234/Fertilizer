'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWarehouse, deleteWarehouse } from '@/app/actions/warehouses';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface ProductStock {
    id: string;
    quantity: number;
    product: { name: string };
}

interface Warehouse {
    id: string;
    name: string;
    location: string | null;
    isActive: boolean;
    productStocks: ProductStock[];
}

export default function WarehouseCard({ wh }: { wh: Warehouse }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(wh.name);
    const [location, setLocation] = useState(wh.location || '');
    const [isActive, setIsActive] = useState(wh.isActive);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const totalStock = wh.productStocks.reduce((sum, s) => sum + s.quantity, 0);

    const handleSave = async () => {
        if (!name.trim()) {
            setAlertModal({ open: true, message: 'กรุณาระบุชื่อคลัง', type: 'warning', title: 'ข้อมูลไม่ครบ' });
            return;
        }
        setSaving(true);
        try {
            await updateWarehouse(wh.id, { name: name.trim(), location: location.trim() || undefined, isActive });
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
            await deleteWarehouse(wh.id);
            router.refresh();
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    const handleCancel = () => {
        setName(wh.name);
        setLocation(wh.location || '');
        setIsActive(wh.isActive);
        setEditing(false);
    };

    return (
        <div className={`bg-white rounded-xl shadow-md border ${editing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'} p-5 hover:shadow-lg transition-shadow`}>
            {editing ? (
                /* Edit Mode */
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ชื่อคลัง *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ที่ตั้ง</label>
                        <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id={`active-${wh.id}`} checked={isActive} onChange={e => setIsActive(e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                        <label htmlFor={`active-${wh.id}`} className="text-sm text-gray-600">เปิดใช้งาน</label>
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
                /* Display Mode */
                <>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">
                                🏭
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">{wh.name}</h3>
                                {wh.location && (
                                    <p className="text-xs text-gray-400">{wh.location}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${wh.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                                }`}>
                                {wh.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">สินค้าทั้งหมด</p>
                            <p className="text-lg font-bold text-gray-800">{wh.productStocks.length}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">จำนวน Stock</p>
                            <p className="text-lg font-bold text-emerald-600">{totalStock.toLocaleString()}</p>
                        </div>
                    </div>

                    {wh.productStocks.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500">สินค้าในคลัง:</p>
                            {wh.productStocks.slice(0, 3).map((ps) => (
                                <div key={ps.id} className="flex justify-between text-xs text-gray-600">
                                    <span>{ps.product.name}</span>
                                    <span className="font-medium">{ps.quantity.toLocaleString()}</span>
                                </div>
                            ))}
                            {wh.productStocks.length > 3 && (
                                <p className="text-xs text-gray-400">+{wh.productStocks.length - 3} รายการ</p>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
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
                message={`ต้องการลบคลัง "${wh.name}" หรือไม่?`}
                variant="danger"
                confirmText="ลบ"
            />
        </div>
    );
}
