'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/app/actions/customers';
import AlertModal from '@/components/AlertModal';

interface CustomerGroup { id: string; name: string; }

export default function NewCustomerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<CustomerGroup[]>([]);
    const [form, setForm] = useState({ name: '', phone: '', customerGroupId: '', address: '', taxId: '' });
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

    useEffect(() => {
        fetch('/api/customer-groups').then(r => r.json()).then(data => {
            setGroups(data);
            if (data.length > 0) setForm(f => ({ ...f, customerGroupId: data[0].id }));
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCustomer(form);
            router.push('/customers');
        } catch (error) {
            setAlertModal({ open: true, message: (error as Error).message });
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-lg mx-auto animate-fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">ลงทะเบียนลูกค้าใหม่</h1>
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">ชื่อลูกค้า *</label>
                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">เบอร์โทร *</label>
                    <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" placeholder="0812345678" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">กลุ่มลูกค้า *</label>
                    <select value={form.customerGroupId} onChange={e => setForm({ ...form, customerGroupId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm">
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">ที่อยู่</label>
                    <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none" rows={2} placeholder="ที่อยู่สำหรับออกใบกำกับ" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">เลขประจำตัวผู้เสียภาษี</label>
                    <input type="text" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" placeholder="เลข 13 หลัก" />
                </div>
                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50">{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal({ open: false, message: '' })} message={alertModal.message} type="error" title="เกิดข้อผิดพลาด" />
        </div>
    );
}
