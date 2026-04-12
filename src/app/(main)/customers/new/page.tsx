'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/app/actions/customers';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import FormInput from '@/components/FormInput';
import FormSelect from '@/components/FormSelect';
import FormTextarea from '@/components/FormTextarea';

interface CustomerGroup { id: string; name: string; }

export default function NewCustomerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<CustomerGroup[]>([]);
    const [form, setForm] = useState({ name: '', phone: '', customerGroupId: '', address: '', taxId: '' });
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const [existingMatches, setExistingMatches] = useState<{name: string, phone: string}[]>([]);

    useEffect(() => {
        fetch('/api/customer-groups').then(r => r.json()).then(data => {
            setGroups(data);
            const defaultGroup = data.find((g: CustomerGroup) => g.name === 'ลูกค้าทั่วไป');
            if (defaultGroup) setForm(f => ({ ...f, customerGroupId: defaultGroup.id }));
            else if (data.length > 0) setForm(f => ({ ...f, customerGroupId: data[0].id }));
        });
    }, []);

    useEffect(() => {
        if (!form.name || form.name.length < 2) {
            setExistingMatches([]);
            return;
        }
        const timer = setTimeout(() => {
            fetch(`/api/customers?search=${encodeURIComponent(form.name)}`)
                .then(r => r.json())
                .then(data => setExistingMatches(data))
                .catch(() => setExistingMatches([]));
        }, 400);
        return () => clearTimeout(timer);
    }, [form.name]);

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

    const isDuplicate = existingMatches.some(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase());

    return (
        <div className="max-w-lg mx-auto animate-fade-in">
            <PageHeader title="ลงทะเบียนลูกค้าใหม่" />
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
                <FormInput
                    label="ชื่อลูกค้า"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    suggestions={existingMatches.map(c => c.name)}
                    error={isDuplicate ? '⚠️ มีชื่อลูกค้านี้อยู่ในระบบแล้ว' : undefined}
                />
                <FormInput
                    label="เบอร์โทร"
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="0812345678"
                    suggestions={existingMatches.filter(c => c.phone).map(c => c.phone)}
                />
                <FormSelect
                    label="กลุ่มลูกค้า"
                    value={form.customerGroupId}
                    onChange={e => setForm({ ...form, customerGroupId: e.target.value })}
                    options={groups.map(g => ({ value: g.id, label: g.name }))}
                    required
                />
                <FormTextarea
                    label="ที่อยู่"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    rows={2}
                    placeholder="ที่อยู่สำหรับออกใบกำกับ"
                />
                <FormInput
                    label="เลขประจำตัวผู้เสียภาษี"
                    value={form.taxId}
                    onChange={e => setForm({ ...form, taxId: e.target.value })}
                    placeholder="เลข 13 หลัก"
                />
                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50">{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                </div>
            </form>
            <AlertModal open={alertModal.open} onClose={() => setAlertModal({ open: false, message: '' })} message={alertModal.message} type="error" title="เกิดข้อผิดพลาด" />
        </div>
    );
}
