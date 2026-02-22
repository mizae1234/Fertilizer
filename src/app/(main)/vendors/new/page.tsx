'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendor } from '@/app/actions/vendors';
import AlertModal from '@/components/AlertModal';

export default function NewVendorPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        lineId: '',
        address: '',
    });

    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'error' }>({ open: false, message: '', type: 'error' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            await createVendor(form);
            router.push('/vendors');
        } catch (error) {
            console.error(error);
            setAlertModal({ open: true, message: 'ไม่สามารถบันทึกได้ กรุณาลองใหม่', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">เพิ่มผู้ขายใหม่</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">ชื่อผู้ขาย / บริษัท *</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        placeholder="ชื่อผู้ขายหรือบริษัท"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">เบอร์โทร</label>
                    <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        placeholder="0812345678"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">LINE ID</label>
                    <input
                        type="text"
                        value={form.lineId}
                        onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        placeholder="LINE ID สำหรับติดต่อสั่งซื้อ"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">ที่อยู่</label>
                    <textarea
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        rows={3}
                        placeholder="ที่อยู่ผู้ขาย"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal(prev => ({ ...prev, open: false }))} message={alertModal.message} type={alertModal.type} title="เกิดข้อผิดพลาด" />
        </div>
    );
}
