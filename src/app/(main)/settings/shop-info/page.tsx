'use client';

import { useState, useEffect } from 'react';
import AlertModal from '@/components/AlertModal';

export default function ShopInfoPage() {
    const [name, setName] = useState('');
    const [taxId, setTaxId] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
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
                    setLogoUrl(data.logoUrl || null);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setAlertModal({ open: true, message: 'ไฟล์ใหญ่เกินไป (สูงสุด 2MB)', type: 'error', title: 'ข้อผิดพลาด' });
            return;
        }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 400;
            const scale = Math.min(1, maxW / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setLogoUrl(canvas.toDataURL('image/png'));
        };
        img.src = URL.createObjectURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/shop-info', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, taxId, address, notes, logoUrl }),
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
                {/* Logo Upload */}
                <div>
                    <label className="text-xs text-gray-400 mb-2 block">โลโก้ร้าน</label>
                    <div className="flex items-start gap-4">
                        <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <span className="text-3xl text-gray-300">🖼️</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-medium cursor-pointer hover:bg-emerald-100 transition-colors inline-block text-center">
                                📤 อัปโหลดโลโก้
                                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
                            </label>
                            {logoUrl && (
                                <button onClick={() => setLogoUrl(null)}
                                    className="px-4 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors">
                                    🗑️ ลบโลโก้
                                </button>
                            )}
                            <p className="text-[11px] text-gray-400">PNG, JPG สูงสุด 2MB</p>
                        </div>
                    </div>
                </div>

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
