'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteUser } from '@/app/actions/users';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

interface UserInfo {
    id: string;
    username: string;
    name: string;
    role: string;
    allowedMenus: string[] | null;
    createdAt: string;
}

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/users')
            .then(r => r.json())
            .then(data => { setUsers(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string) => {
        try {
            await deleteUser(id);
            setUsers(users.filter(u => u.id !== id));
            setAlertModal({ open: true, message: 'ลบผู้ใช้สำเร็จ', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'ผิดพลาด' });
        }
        setConfirmDelete(null);
    };

    const roleLabel = (role: string) => role === 'ADMIN' ? 'ผู้ดูแล' : 'พนักงาน';
    const roleBadge = (role: string) =>
        role === 'ADMIN'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700';

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <PageHeader
                title="👤 จัดการผู้ใช้"
                subtitle="เพิ่ม แก้ไข ลบ ผู้ใช้ และกำหนดสิทธิ์เมนู"
                actions={
                    <Link href="/users/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 transition-all">
                        + เพิ่มผู้ใช้
                    </Link>
                }
            />

            {/* Users List */}
            {loading ? (
                <LoadingSpinner />
            ) : users.length === 0 ? (
                <EmptyState icon="👤" title="ยังไม่มีผู้ใช้" />
            ) : (
                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                            {/* Avatar + Info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-gray-800 truncate">{user.name}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleBadge(user.role)}`}>
                                            {roleLabel(user.role)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">@{user.username}</p>
                                    <p className="text-xs text-gray-400">
                                        เมนู: {user.allowedMenus === null ? (
                                            <span className="text-emerald-600 font-medium">ทั้งหมด</span>
                                        ) : (
                                            <span className="text-amber-600 font-medium">{(user.allowedMenus as string[]).length} เมนู</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => router.push(`/users/${user.id}`)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                                >
                                    ✏️ แก้ไข
                                </button>
                                {user.username !== 'admin' && (
                                    <button
                                        onClick={() => setConfirmDelete(user.id)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                                    >
                                        🗑️ ลบ
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">ยืนยันการลบ</h3>
                        <p className="text-sm text-gray-500 mb-4">ต้องการลบผู้ใช้นี้หรือไม่? การลบจะไม่สามารถกู้คืนได้</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">ยกเลิก</button>
                            <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 rounded-xl text-sm bg-red-500 text-white hover:bg-red-600">ลบ</button>
                        </div>
                    </div>
                </div>
            )}

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
