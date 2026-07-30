'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from '@/lib/utils';

// ==================== EXCEL EXPORT UTIL ====================
function exportToExcel(data: Record<string, unknown>[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

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
    const [uploadError, setUploadError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    // Transfers modal states
    const [selectedAccountForTransfers, setSelectedAccountForTransfers] = useState<BankAccount | null>(null);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [transfersLoading, setTransfersLoading] = useState(false);
    const [transfersSearch, setTransfersSearch] = useState('');
    const [transfersTypeFilter, setTransfersTypeFilter] = useState<'ALL' | 'POS' | 'PAY_DEBT'>('ALL');

    const handleViewTransfers = async (acc: BankAccount) => {
        setSelectedAccountForTransfers(acc);
        setTransfersLoading(true);
        setTransfers([]);
        setTransfersSearch('');
        setTransfersTypeFilter('ALL');
        try {
            const res = await fetch(`/api/bank-accounts/${acc.id}/transfers`);
            const data = await res.json();
            setTransfers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setTransfersLoading(false);
        }
    };

    const handleExportTransfers = () => {
        if (!selectedAccountForTransfers || transfers.length === 0) return;
        const q = transfersSearch.toLowerCase().trim();
        const filtered = transfers.filter(t => {
            const matchesSearch = t.reference.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q);
            const matchesType = transfersTypeFilter === 'ALL' || t.type === transfersTypeFilter;
            return matchesSearch && matchesType;
        });

        exportToExcel(filtered.map(t => ({
            'วันที่-เวลา': formatDate(t.date) + ' ' + new Date(t.date).toLocaleTimeString('th-TH'),
            'เลขที่อ้างอิง': t.reference,
            'ประเภท': t.type === 'POS' ? 'ขายหน้าร้าน POS' : 'รับชำระหนี้',
            'ชื่อลูกค้า': t.customerName,
            'ยอดเงินโอน': t.amount
        })), `ยอดเงินโอนเข้า_${selectedAccountForTransfers.bankName}_${selectedAccountForTransfers.accountNumber}`);
    };

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
            setUploadError('ไฟล์ใหญ่เกินไป (สูงสุด 2MB)');
            setTimeout(() => setUploadError(''), 3000);
            return;
        }
        setUploadError('');
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
            <PageHeader
                title="🏦 จัดการบัญชีร้านค้า"
                subtitle="เพิ่ม/แก้ไขบัญชีธนาคารสำหรับรับชำระ"
                actions={
                    !showForm ? (
                        <button onClick={() => { resetForm(); setShowForm(true); }}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                            ➕ เพิ่มบัญชี
                        </button>
                    ) : undefined
                }
            />

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
                                    {uploadError && <p className="text-xs text-red-500 mt-1">⚠️ {uploadError}</p>}
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
                <LoadingSpinner />
            ) : accounts.length === 0 ? (
                <EmptyState icon="🏦" title="ยังไม่มีบัญชีธนาคาร" description='กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่มต้น' />
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
                                    <button onClick={() => handleViewTransfers(acc)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                                        💸 รายการโอนเข้า
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

            {/* Transfers Modal */}
            {selectedAccountForTransfers && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">💸 รายการเงินโอนเข้าบัญชี</h3>
                                <p className="text-xs text-purple-100 mt-0.5">{selectedAccountForTransfers.accountName} · {selectedAccountForTransfers.bankName} · {selectedAccountForTransfers.accountNumber}</p>
                            </div>
                            <button onClick={() => setSelectedAccountForTransfers(null)} className="text-white/80 hover:text-white text-2xl font-semibold leading-none">&times;</button>
                        </div>

                        {/* Controls & Summary */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
                            <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap">
                                <input
                                    type="text"
                                    value={transfersSearch}
                                    onChange={e => setTransfersSearch(e.target.value)}
                                    placeholder="🔍 ค้นหาเลขที่บิล / ชื่อลูกค้า..."
                                    className="flex-1 min-w-[200px] px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                />
                                <select
                                    value={transfersTypeFilter}
                                    onChange={e => setTransfersTypeFilter(e.target.value as any)}
                                    className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 bg-white"
                                >
                                    <option value="ALL">ทั้งหมด</option>
                                    <option value="POS">ขายหน้าร้าน POS</option>
                                    <option value="PAY_DEBT">ชำระหนี้ย้อนหลัง</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">ยอดโอนรวมที่แสดง</p>
                                    <p className="text-lg font-bold text-purple-600">
                                        {formatCurrency(
                                            transfers
                                                .filter(t => {
                                                    const matchesSearch = t.reference.toLowerCase().includes(transfersSearch.toLowerCase().trim()) || t.customerName.toLowerCase().includes(transfersSearch.toLowerCase().trim());
                                                    const matchesType = transfersTypeFilter === 'ALL' || t.type === transfersTypeFilter;
                                                    return matchesSearch && matchesType;
                                                })
                                                .reduce((sum, t) => sum + t.amount, 0)
                                        )}
                                    </p>
                                </div>
                                <button
                                    onClick={handleExportTransfers}
                                    disabled={transfers.length === 0}
                                    className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 font-bold text-xs rounded-xl transition-all shadow-sm"
                                >
                                    📥 Export Excel
                                </button>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {transfersLoading ? (
                                <div className="py-12"><LoadingSpinner /></div>
                            ) : transfers.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-12">ไม่พบรายการเงินโอนเข้า</p>
                            ) : (() => {
                                const q = transfersSearch.toLowerCase().trim();
                                const filtered = transfers.filter(t => {
                                    const matchesSearch = t.reference.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q);
                                    const matchesType = transfersTypeFilter === 'ALL' || t.type === transfersTypeFilter;
                                    return matchesSearch && matchesType;
                                });

                                if (filtered.length === 0) {
                                    return <p className="text-gray-400 text-sm text-center py-12">ไม่พบข้อมูลที่ตรงกับเงื่อนไขค้นหา</p>;
                                }

                                return (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                                                    <th className="text-left py-2 px-3 font-medium">วันที่-เวลา</th>
                                                    <th className="text-left py-2 px-3 font-medium">เลขที่อ้างอิง</th>
                                                    <th className="text-left py-2 px-3 font-medium">ประเภท</th>
                                                    <th className="text-left py-2 px-3 font-medium">ชื่อลูกค้า</th>
                                                    <th className="text-right py-2 px-3 font-medium">ยอดเงินโอน</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filtered.map((t) => (
                                                    <tr key={t.id} className="hover:bg-gray-50">
                                                        <td className="py-3 px-3 text-xs text-gray-500">
                                                            {new Date(t.date).toLocaleString('th-TH', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="py-3 px-3 font-medium">
                                                            <Link
                                                                href={`/sales/${t.id.split('-pos-')[0]}`}
                                                                className="text-purple-600 hover:text-purple-800 underline"
                                                            >
                                                                {t.reference}
                                                            </Link>
                                                        </td>
                                                        <td className="py-3 px-3 text-xs">
                                                            <span className={`px-2 py-0.5 rounded-full font-medium ${t.type === 'POS' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {t.type === 'POS' ? 'ขายหน้าร้าน POS' : 'รับชำระหนี้'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-700">
                                                            {t.customerName}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                                                            {formatCurrency(t.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setSelectedAccountForTransfers(null)}
                                className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 font-medium text-sm rounded-xl transition-all"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
