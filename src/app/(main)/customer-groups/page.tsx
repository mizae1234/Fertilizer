'use client';

import { useState, useEffect } from 'react';
import { createCustomerGroup, updateCustomerGroup, deleteCustomerGroup } from '@/app/actions/customer-groups';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

interface Group {
    id: string;
    name: string;
    _count: { customers: number; productPrices: number };
}

export default function CustomerGroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });
    const [page, setPage] = useState(1);
    const perPage = 15;

    const loadGroups = async () => {
        const res = await fetch('/api/customer-groups');
        const data = await res.json();
        setGroups(data);
        setLoading(false);
    };

    useEffect(() => { loadGroups(); }, []);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        try {
            await createCustomerGroup(newName);
            setNewName('');
            await loadGroups();
            setAlertModal({ open: true, message: 'เพิ่มกลุ่มลูกค้าเรียบร้อย', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setAdding(false); }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        setActionLoading(true);
        try {
            await updateCustomerGroup(id, editName);
            setEditId(null);
            await loadGroups();
            setAlertModal({ open: true, message: 'แก้ไขชื่อกลุ่มเรียบร้อย', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setActionLoading(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setActionLoading(true);
        try {
            await deleteCustomerGroup(deleteTarget.id);
            setDeleteTarget(null);
            await loadGroups();
            setAlertModal({ open: true, message: 'ลบกลุ่มลูกค้าเรียบร้อย', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setActionLoading(false); }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <PageHeader
                title="กลุ่มลูกค้า"
                subtitle={`จัดการกลุ่มลูกค้าสำหรับตั้งราคาสินค้า (${groups.length} กลุ่ม)`}
            />

            {/* Add new group */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="ชื่อกลุ่มลูกค้าใหม่..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={adding || !newName.trim()}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {adding ? 'กำลังเพิ่ม...' : '+ เพิ่มกลุ่ม'}
                    </button>
                </div>
            </div>

            {/* Groups list */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {groups.length === 0 ? (
                    <EmptyState icon="👥" title="ยังไม่มีกลุ่มลูกค้า" />
                ) : (
                    <div className="divide-y divide-gray-50">
                        {groups.slice((page - 1) * perPage, page * perPage).map(group => (
                            <div key={group.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                                {editId === group.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleUpdate(group.id)}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdate(group.id)} disabled={actionLoading}
                                            className="text-xs text-emerald-600 font-medium hover:underline disabled:opacity-50">บันทึก</button>
                                        <button onClick={() => setEditId(null)}
                                            className="text-xs text-gray-400 hover:text-gray-600">ยกเลิก</button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-800">{group.name}</p>
                                            <p className="text-xs text-gray-400">
                                                ลูกค้า {group._count.customers} ราย · สินค้า {group._count.productPrices} ราคา
                                            </p>
                                        </div>
                                        <button onClick={() => { setEditId(group.id); setEditName(group.name); }}
                                            className="text-xs text-blue-500 hover:underline">แก้ไข</button>
                                        <button onClick={() => setDeleteTarget(group)}
                                            className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {groups.length > perPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">หน้า {page} จาก {Math.ceil(groups.length / perPage)}</p>
                        <div className="flex gap-1">
                            {page > 1 && (
                                <button onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ก่อนหน้า</button>
                            )}
                            {page < Math.ceil(groups.length / perPage) && (
                                <button onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ถัดไป</button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="ยืนยันลบกลุ่มลูกค้า"
                message={`ต้องการลบกลุ่ม "${deleteTarget?.name}" ใช่หรือไม่?${deleteTarget && deleteTarget._count.customers > 0 ? ` (มีลูกค้า ${deleteTarget._count.customers} ราย จะไม่สามารถลบได้)` : ''}`}
                confirmText="ลบ"
                variant="danger"
                loading={actionLoading}
            />
            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
