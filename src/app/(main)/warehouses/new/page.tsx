'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWarehouse } from '@/app/actions/warehouses';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import FormInput from '@/components/FormInput';

export default function NewWarehousePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createWarehouse({ name, location });
            router.push('/warehouses');
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto animate-fade-in">
            <PageHeader title="เพิ่มคลังสินค้าใหม่" />

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                <FormInput
                    label="ชื่อคลังสินค้า"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น คลังหลัก, คลังสาขา 1"
                    required
                />

                <FormInput
                    label="ที่ตั้ง"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="เช่น กรุงเทพฯ, เชียงใหม่"
                />

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal({ open: false, message: '' })} message={alertModal.message} type="error" title="เกิดข้อผิดพลาด" />
        </div>
    );
}
