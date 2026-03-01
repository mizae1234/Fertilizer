'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createExpense } from '@/app/actions/expenses';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import FormInput from '@/components/FormInput';
import FormTextarea from '@/components/FormTextarea';

export default function NewExpensePage() {
    const router = useRouter();
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!category) { showAlert('กรุณาเลือกหมวดหมู่', 'warning', 'ข้อมูลไม่ครบ'); return; }
        if (!amount || parseFloat(amount) <= 0) { showAlert('กรุณาระบุจำนวนเงิน', 'warning', 'ข้อมูลไม่ครบ'); return; }

        setSaving(true);
        try {
            await createExpense({
                category,
                amount: parseFloat(amount),
                description: description || undefined,
                reference: reference || undefined,
                expenseDate: expenseDate || undefined,
            });
            router.push('/expenses');
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <PageHeader title="เพิ่มรายจ่ายใหม่" subtitle="บันทึกค่าใช้จ่ายในกิจการ" />
            </div>

            <form onSubmit={handleSubmit}>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-6 space-y-5">
                    {/* Category */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">หมวดหมู่ *</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {EXPENSE_CATEGORIES.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCategory(c)}
                                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${category === c
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                                        }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount */}
                    <FormInput
                        label="จำนวนเงิน (บาท)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormInput
                            label="วันที่จ่าย"
                            type="date"
                            value={expenseDate}
                            onChange={e => setExpenseDate(e.target.value)}
                        />
                        <FormInput
                            label="เลขที่อ้างอิง"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            placeholder="เช่น เลขใบเสร็จ, INV-xxxxx"
                        />
                    </div>

                    {/* Description */}
                    <FormTextarea
                        label="รายละเอียด"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="รายละเอียดค่าใช้จ่าย..."
                    />
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50 transition-all"
                >
                    {saving ? '💾 กำลังบันทึก...' : '💾 บันทึกรายจ่าย'}
                </button>
            </form>

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
