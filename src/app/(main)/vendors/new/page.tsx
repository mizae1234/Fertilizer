'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendor } from '@/app/actions/vendors';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import FormInput from '@/components/FormInput';
import FormTextarea from '@/components/FormTextarea';

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
            <PageHeader title="เพิ่มผู้ขายใหม่" />

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 space-y-4">
                <FormInput
                    label="ชื่อผู้ขาย / บริษัท"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ชื่อผู้ขายหรือบริษัท"
                    required
                />

                <FormInput
                    label="เบอร์โทร"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0812345678"
                />

                <FormInput
                    label="LINE ID"
                    value={form.lineId}
                    onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                    placeholder="LINE ID สำหรับติดต่อสั่งซื้อ"
                />

                <FormTextarea
                    label="ที่อยู่"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    rows={3}
                    placeholder="ที่อยู่ผู้ขาย"
                />

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
