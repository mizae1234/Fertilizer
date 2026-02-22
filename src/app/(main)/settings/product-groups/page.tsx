'use client';

import { useState, useEffect, useCallback } from 'react';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface ProductGroup {
    id: string;
    name: string;
    _count: { products: number };
}

export default function ProductGroupsPage() {
    const [groups, setGroups] = useState<ProductGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ProductGroup | null>(null);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'success' });

    const loadGroups = useCallback(async () => {
        const res = await fetch('/api/product-groups');
        const data = await res.json();
        setGroups(data);
        setLoading(false);
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const res = await fetch('/api/product-groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
            }
            setNewName('');
            setAlertModal({ open: true, message: 'เพิ่มหมวดหมู่สำเร็จ', type: 'success', title: 'สำเร็จ' });
            await loadGroups();
        } catch (e) {
            setAlertModal({ open: true, message: (e as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setAdding(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await fetch(`/api/product-groups?id=${deleteTarget.id}`, { method: 'DELETE' });
            setAlertModal({ open: true, message: 'ลบหมวดหมู่สำเร็จ', type: 'success', title: 'สำเร็จ' });
            setDeleteTarget(null);
            await loadGroups();
        } catch {
            setAlertModal({ open: true, message: 'ไม่สามารถลบได้', type: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">📦 หมวดหมู่สินค้า</h1>
                <p className="text-sm text-gray-500 mt-1">จัดการหมวดหมู่สินค้า (Product Group)</p>
            </div>

            {/* Add Form */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="ชื่อหมวดหมู่ เช่น ปุ๋ยเคมี, ยาฆ่าแมลง..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={adding || !newName.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {adding ? '...' : '+ เพิ่ม'}
                    </button>
                </div>
            </div>

            {/* Group List */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {groups.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                        <p className="text-lg mb-2">📁</p>
                        <p>ยังไม่มีหมวดหมู่</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {groups.map(g => (
                            <div key={g.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg">📦</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                                    <p className="text-xs text-gray-400">{g._count.products} สินค้า</p>
                                </div>
                                <button
                                    onClick={() => setDeleteTarget(g)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                >
                                    ลบ
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="ยืนยันลบหมวดหมู่"
                message={`ต้องการลบ "${deleteTarget?.name}" ใช่หรือไม่? สินค้าที่อยู่ในหมวดนี้จะถูกยกเลิกการผูก`}
                confirmText="ลบ"
                variant="danger"
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
