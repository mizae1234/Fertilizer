'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { updateUser } from '@/app/actions/users';
import { MENU_GROUPS, ALL_MENU_HREFS } from '@/lib/menus';
import AlertModal from '@/components/AlertModal';

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'STAFF'>('STAFF');
    const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
    const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>('');
    const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        Promise.all([
            fetch(`/api/users/${id}`).then(r => r.json()),
            fetch('/api/warehouses').then(r => r.json()),
        ]).then(([data, wh]) => {
            setUsername(data.username);
            setName(data.name);
            setRole(data.role);
            setSelectedMenus(data.allowedMenus ?? [...ALL_MENU_HREFS]);
            setDefaultWarehouseId(data.defaultWarehouseId || '');
            setWarehouses(wh);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    const isAdmin = role === 'ADMIN';

    const toggleMenu = (href: string) => {
        setSelectedMenus(prev =>
            prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
        );
    };

    const toggleGroup = (group: typeof MENU_GROUPS[0]) => {
        const groupHrefs = group.items.map(i => i.href);
        const allSelected = groupHrefs.every(h => selectedMenus.includes(h));
        if (allSelected) {
            setSelectedMenus(prev => prev.filter(h => !groupHrefs.includes(h)));
        } else {
            setSelectedMenus(prev => [...new Set([...prev, ...groupHrefs])]);
        }
    };

    const selectAll = () => setSelectedMenus([...ALL_MENU_HREFS]);
    const deselectAll = () => setSelectedMenus([]);

    const handleSubmit = async () => {
        if (!username.trim() || !name.trim()) {
            setAlertModal({ open: true, message: 'กรุณากรอกข้อมูลให้ครบ', type: 'error', title: 'ข้อมูลไม่ครบ' });
            return;
        }

        setSaving(true);
        try {
            await updateUser(id, {
                username: username.trim(),
                name: name.trim(),
                role,
                ...(password ? { password } : {}),
                allowedMenus: isAdmin ? null : selectedMenus,
                defaultWarehouseId: defaultWarehouseId || null,
            });
            setAlertModal({ open: true, message: 'แก้ไขผู้ใช้สำเร็จ', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'ผิดพลาด' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.push('/users')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">✏️ แก้ไขผู้ใช้</h1>
                    <p className="text-sm text-gray-500 mt-1">@{username}</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">ชื่อผู้ใช้ (Username) *</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">รหัสผ่าน <span className="text-gray-300">(ไม่กรอก = ไม่เปลี่ยน)</span></label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">ชื่อ-สกุล *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">บทบาท *</label>
                        <select
                            value={role}
                            onChange={e => {
                                const newRole = e.target.value as 'ADMIN' | 'STAFF';
                                setRole(newRole);
                                if (newRole === 'ADMIN') selectAll();
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="STAFF">พนักงาน (STAFF)</option>
                            <option value="ADMIN">ผู้ดูแลระบบ (ADMIN)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">คลังสินค้าเริ่มต้น (POS)</label>
                        <select
                            value={defaultWarehouseId}
                            onChange={e => setDefaultWarehouseId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">ไม่ระบุ</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Menu Access */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-700">🔐 สิทธิ์เข้าถึงเมนู</h2>
                    {!isAdmin && (
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-xs text-emerald-600 hover:underline">เลือกทั้งหมด</button>
                            <span className="text-gray-300">|</span>
                            <button onClick={deselectAll} className="text-xs text-red-500 hover:underline">ล้างทั้งหมด</button>
                        </div>
                    )}
                </div>

                {isAdmin ? (
                    <div className="px-4 py-3 rounded-xl bg-purple-50 border border-purple-100 text-sm text-purple-600">
                        👑 ผู้ดูแลระบบ (ADMIN) เข้าถึงได้ทุกเมนู
                    </div>
                ) : (
                    <div className="space-y-4">
                        {MENU_GROUPS.map(group => {
                            const groupHrefs = group.items.map(i => i.href);
                            const allSelected = groupHrefs.every(h => selectedMenus.includes(h));
                            const someSelected = groupHrefs.some(h => selectedMenus.includes(h));

                            return (
                                <div key={group.label}>
                                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={el => {
                                                if (el) el.indeterminate = someSelected && !allSelected;
                                            }}
                                            onChange={() => toggleGroup(group)}
                                            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</span>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-6">
                                        {group.items.map(item => (
                                            <label key={item.href} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMenus.includes(item.href)}
                                                    onChange={() => toggleMenu(item.href)}
                                                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                                                />
                                                <span className="text-sm">{item.icon} {item.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isAdmin && (
                    <p className="text-xs text-gray-400 mt-3">
                        เลือกแล้ว {selectedMenus.length}/{ALL_MENU_HREFS.length} เมนู
                    </p>
                )}
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-base hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all"
            >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
            </button>

            <AlertModal
                open={alertModal.open}
                onClose={() => {
                    setAlertModal(prev => ({ ...prev, open: false }));
                    if (alertModal.type === 'success') router.push('/users');
                }}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}
