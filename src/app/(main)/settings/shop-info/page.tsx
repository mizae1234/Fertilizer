'use client';

import { useState, useEffect } from 'react';
import AlertModal from '@/components/AlertModal';

export default function ShopInfoPage() {
    const [name, setName] = useState('');
    const [taxId, setTaxId] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'error' });

    useEffect(() => {
        fetch('/api/shop-info')
            .then(r => r.json())
            .then(data => {
                if (data.name !== undefined) {
                    setName(data.name || '');
                    setTaxId(data.taxId || '');
                    setAddress(data.address || '');
                    setNotes(data.notes || '');
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/shop-info', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, taxId, address, notes }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAlertModal({ open: true, message: 'บันทึกข้อมูลร้านเรียบร้อย', type: 'success', title: 'สำเร็จ' });
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">🏪 ข้อมูลร้านค้า</h1>
                <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลร้านค้าสำหรับใช้ในเอกสารและใบเสร็จ</p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 space-y-5 mb-6">
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">ชื่อร้าน</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="เช่น ร้านปุ๋ยเกษตร"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 block">เลขประจำตัวผู้เสียภาษี</label>
                    <input
                        type="text"
                        value={taxId}
                        onChange={e => setTaxId(e.target.value)}
                        placeholder="เช่น 1234567890123"
                        maxLength={13}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono tracking-wider"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 block">ที่อยู่</label>
                    <textarea
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="ที่อยู่ร้านค้า สำหรับใช้ในเอกสาร"
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 block">หมายเหตุ</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="หมายเหตุเพิ่มเติม"
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-base hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all"
            >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
            </button>

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
