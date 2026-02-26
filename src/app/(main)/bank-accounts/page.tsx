'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface BankAccount {
    id: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    qrCodeUrl: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
}

const BANKS = [
    'ธนาคารกสิกรไทย',
    'ธนาคารไทยพาณิชย์',
    'ธนาคารกรุงเทพ',
    'ธนาคารกรุงไทย',
    'ธนาคารกรุงศรีอยุธยา',
    'ธนาคารทหารไทยธนชาต',
    'ธนาคารออมสิน',
    'ธนาคาร ธ.ก.ส.',
    'ธนาคารเกียรตินาคินภัทร',
    'ธนาคารซีไอเอ็มบีไทย',
    'ธนาคารทิสโก้',
    'PromptPay',
    'อื่นๆ',
];

export default function BankAccountsPage() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ accountName: '', accountNumber: '', bankName: '', qrCodeUrl: '' as string | null, isDefault: false });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const loadAccounts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/bank-accounts');
            const data = await res.json();
            setAccounts(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const resetForm = () => {
        setForm({ accountName: '', accountNumber: '', bankName: '', qrCodeUrl: null, isDefault: false });
        setEditId(null);
        setShowForm(false);
    };

    const handleEdit = (acc: BankAccount) => {
        setForm({ accountName: acc.accountName, accountNumber: acc.accountNumber, bankName: acc.bankName, qrCodeUrl: acc.qrCodeUrl, isDefault: acc.isDefault });
        setEditId(acc.id);
        setShowForm(true);
    };

    const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('ไฟล์ใหญ่เกินไป (สูงสุด 2MB)');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setForm(f => ({ ...f, qrCodeUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.accountName || !form.accountNumber || !form.bankName) return;
        setSaving(true);
        try {
            if (editId) {
                await fetch(`/api/bank-accounts/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                });
            } else {
                await fetch('/api/bank-accounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                });
            }
            resetForm();
            loadAccounts();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });
            setDeleteConfirm(null);
            loadAccounts();
        } catch (e) { console.error(e); }
    };

    const handleSetDefault = async (id: string) => {
        await fetch(`/api/bank-accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isDefault: true }),
        });
        loadAccounts();
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        await fetch(`/api/bank-accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !isActive }),
        });
        loadAccounts();
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🏦 จัดการบัญชีร้านค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">เพิ่ม/แก้ไขบัญชีธนาคารสำหรับรับชำระ</p>
                </div>
                {!showForm && (
                    <button onClick={() => { resetForm(); setShowForm(true); }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                        ➕ เพิ่มบัญชี
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">{editId ? '✏️ แก้ไขบัญชี' : '➕ เพิ่มบัญชีใหม่'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี <span className="text-red-500">*</span></label>
                                <input type="text" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                                    placeholder="เช่น บริษัท ปุ๋ยดี จำกัด"
                                    className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่บัญชี <span className="text-red-500">*</span></label>
                                <input type="text" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                                    placeholder="เช่น 123-4-56789-0"
                                    className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร <span className="text-red-500">*</span></label>
                            <select value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                                className="w-full px-4 py-2.5 border-0 border-b-2 border-gray-200 focus:border-emerald-500 outline-none text-sm bg-gray-50/50 rounded-t-lg transition-colors" required>
                                <option value="">เลือกธนาคาร...</option>
                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* QR Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">รูป QR Code (สำหรับรับเงิน)</label>
                            <div className="flex items-start gap-4">
                                <div className="flex-1">
                                    <input type="file" ref={fileRef} accept="image/*" onChange={handleQrUpload} className="hidden" />
                                    <button type="button" onClick={() => fileRef.current?.click()}
                                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all">
                                        📷 คลิกเพื่อเลือกรูป QR Code
                                    </button>
                                    <p className="text-xs text-gray-400 mt-1">รองรับ JPG, PNG (สูงสุด 2MB)</p>
                                </div>
                                {form.qrCodeUrl && (
                                    <div className="relative">
                                        <img src={form.qrCodeUrl} alt="QR Preview" className="w-24 h-24 object-contain border border-gray-200 rounded-lg" />
                                        <button type="button" onClick={() => setForm(f => ({ ...f, qrCodeUrl: null }))}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">✕</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Default checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-sm text-gray-700">ตั้งเป็นบัญชีหลัก</span>
                        </label>

                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50">
                                {saving ? '⏳ กำลังบันทึก...' : editId ? '💾 อัปเดต' : '💾 บันทึก'}
                            </button>
                            <button type="button" onClick={resetForm}
                                className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
                                ยกเลิก
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Account List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            ) : accounts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                    <p className="text-4xl mb-3">🏦</p>
                    <p className="text-gray-500">ยังไม่มีบัญชีธนาคาร</p>
                    <p className="text-sm text-gray-400 mt-1">กดปุ่ม &quot;เพิ่มบัญชี&quot; เพื่อเริ่มต้น</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {accounts.map(acc => (
                        <div key={acc.id} className={`bg-white rounded-xl shadow-md border p-5 transition-all ${acc.isDefault ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-gray-100'} ${!acc.isActive ? 'opacity-50' : ''}`}>
                            <div className="flex items-start gap-4">
                                {/* QR Image */}
                                {acc.qrCodeUrl ? (
                                    <img src={acc.qrCodeUrl} alt="QR" className="w-20 h-20 object-contain border border-gray-200 rounded-lg flex-shrink-0" />
                                ) : (
                                    <div className="w-20 h-20 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg flex-shrink-0">
                                        <span className="text-3xl">🏦</span>
                                    </div>
                                )}

                                {/* Account Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-base font-bold text-gray-800">{acc.accountName}</h3>
                                        {acc.isDefault && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">⭐ บัญชีหลัก</span>
                                        )}
                                        {!acc.isActive && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">ปิดใช้งาน</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        <span className="text-gray-400">เลขที่:</span> <span className="font-mono font-semibold">{acc.accountNumber}</span>
                                    </p>
                                    <p className="text-sm text-gray-500 mt-0.5">{acc.bankName}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {!acc.isDefault && acc.isActive && (
                                        <button onClick={() => handleSetDefault(acc.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                            title="ตั้งเป็นบัญชีหลัก">
                                            ⭐ ตั้งเป็นหลัก
                                        </button>
                                    )}
                                    <button onClick={() => handleToggleActive(acc.id, acc.isActive)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${acc.isActive ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}>
                                        {acc.isActive ? '⏸️ ปิด' : '▶️ เปิด'}
                                    </button>
                                    <button onClick={() => handleEdit(acc)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                                        ✏️ แก้ไข
                                    </button>
                                    {deleteConfirm === acc.id ? (
                                        <div className="flex gap-1">
                                            <button onClick={() => handleDelete(acc.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600">ลบ</button>
                                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200">ยกเลิก</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setDeleteConfirm(acc.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                                            🗑️ ลบ
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
