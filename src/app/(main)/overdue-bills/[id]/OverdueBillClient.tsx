'use client';

import { useState, useEffect } from 'react';
import { addInterest, payDebt } from '@/app/actions/debt';
import { useRouter } from 'next/navigation';

const formatCurrency = (n: number) => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 เงินสด' },
    { value: 'TRANSFER', label: '🏦 เงินโอน' },
    { value: 'CREDIT', label: '📋 เครดิต' },
];

interface BankAccountInfo { id: string; bankName: string; accountNumber: string; accountName: string; isDefault: boolean; isActive: boolean; }

interface SaleData {
    id: string;
    saleNumber: string;
    customerName: string;
    remaining: number;
    grandTotal: number;
    totalPaid: number;
    totalInterest: number;
    isPaidOff: boolean;
    currentDueDate: string | null;
    debtPayments: { id: string; amount: number; method: string; dueDate: string | null; note: string | null; paidAt: string }[];
    debtInterests: { id: string; percentage: number; baseAmount: number; amount: number; note: string | null; createdAt: string }[];
}

// ─── Alert Modal ───
function AlertModal({ open, onClose, message, type, title }: { open: boolean; onClose: () => void; message: string; type: 'success' | 'error' | 'warning'; title?: string }) {
    if (!open) return null;
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-orange-500' };
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className={`${colors[type]} text-white px-5 py-4 text-center`}>
                    <p className="text-3xl mb-1">{icons[type]}</p>
                    <p className="font-bold text-lg">{title || (type === 'success' ? 'สำเร็จ' : 'ข้อผิดพลาด')}</p>
                </div>
                <div className="p-5 text-center">
                    <p className="text-gray-600 text-sm mb-4">{message}</p>
                    <button onClick={onClose} className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">ตกลง</button>
                </div>
            </div>
        </div>
    );
}

// ─── Debt Payment Modal ───
function DebtPaymentModal({ total, loading, onConfirm, onClose }: {
    total: number; loading: boolean;
    onConfirm: (payments: { method: string; amount: number; dueDate?: string }[]) => void;
    onClose: () => void;
}) {
    const [lines, setLines] = useState([{ method: 'CASH', amount: total, dueDate: '', bankAccountId: '' }]);
    const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>([]);

    useEffect(() => {
        fetch('/api/bank-accounts').then(r => r.json()).then((data: BankAccountInfo[]) => {
            setBankAccounts(data.filter(a => a.isActive));
        }).catch(() => { });
    }, []);

    const paid = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const remaining = total - paid;
    const isValid = lines.every(l =>
        l.amount > 0 && (l.method !== 'CREDIT' || l.dueDate)
    ) && paid > 0;

    const updateLine = (idx: number, patch: Partial<typeof lines[0]>) => {
        setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
    };
    const removeLine = (idx: number) => {
        const newLines = lines.filter((_, i) => i !== idx);
        setLines(newLines.length === 0 ? [{ method: 'CASH', amount: total, dueDate: '', bankAccountId: '' }] : newLines);
    };
    const addLine = () => {
        const rem = Math.max(0, total - lines.reduce((s, l) => s + (l.amount || 0), 0));
        const defaultBank = bankAccounts.find(a => a.isDefault);
        setLines([...lines, { method: 'CASH', amount: Math.round(rem * 100) / 100, dueDate: '', bankAccountId: defaultBank?.id || '' }]);
    };
    const setFullAmount = (idx: number) => {
        const otherSum = lines.reduce((s, l, i) => i === idx ? s : s + (l.amount || 0), 0);
        updateLine(idx, { amount: Math.round((total - otherSum) * 100) / 100 });
    };
    const handleMethodChange = (idx: number, method: string) => {
        const defaultBank = bankAccounts.find(a => a.isDefault);
        updateLine(idx, {
            method,
            dueDate: method !== 'CREDIT' ? '' : lines[idx].dueDate,
            bankAccountId: method === 'TRANSFER' ? (lines[idx].bankAccountId || defaultBank?.id || '') : '',
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">💳 ชำระหนี้</h3>
                        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
                    </div>
                    <p className="text-3xl font-black mt-1">{formatCurrency(total)}</p>
                    <p className="text-xs text-white/70 mt-0.5">ยอดค้างชำระ</p>
                </div>

                {/* Payment Lines */}
                <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                    {lines.map((line, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/50">
                            <div className="flex gap-1">
                                {PAYMENT_METHODS.map(m => (
                                    <button key={m.value} type="button"
                                        onClick={() => handleMethodChange(idx, m.value)}
                                        className={`flex-1 rounded-lg text-xs font-medium py-1.5 transition-all ${line.method === m.value
                                            ? 'bg-orange-500 text-white shadow-sm'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
                                            }`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Bank selector for TRANSFER */}
                            {line.method === 'TRANSFER' && bankAccounts.length > 0 && (
                                <select value={line.bankAccountId}
                                    onChange={e => updateLine(idx, { bankAccountId: e.target.value })}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                                    <option value="">เลือกบัญชี...</option>
                                    {bankAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.bankName} - {acc.accountNumber} ({acc.accountName}){acc.isDefault ? ' ⭐' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 shrink-0">฿</label>
                                <input type="number" value={line.amount || ''}
                                    onChange={e => updateLine(idx, { amount: parseFloat(e.target.value) || 0 })}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500 text-right"
                                    step="0.01" min={0} placeholder="0.00" />
                                <button type="button" onClick={() => setFullAmount(idx)}
                                    className="px-2 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-[10px] font-medium hover:bg-orange-100 shrink-0 border border-orange-200">
                                    เต็มจำนวน
                                </button>
                                {lines.length > 1 && (
                                    <button type="button" onClick={() => removeLine(idx)}
                                        className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                                )}
                            </div>

                            {line.method === 'CREDIT' && (
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500 shrink-0">📅 กำหนดชำระใหม่:</label>
                                    <input type="date" value={line.dueDate}
                                        onChange={e => updateLine(idx, { dueDate: e.target.value })}
                                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-500" />
                                </div>
                            )}
                        </div>
                    ))}

                    <button type="button" onClick={addLine}
                        className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs font-medium hover:border-orange-400 hover:text-orange-500 transition-colors">
                        + เพิ่มช่องทางชำระ (แยกจ่าย)
                    </button>
                </div>

                <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">ยอดชำระ</span>
                        <span className={`font-bold ${remaining <= 0.01 ? 'text-emerald-600' : 'text-orange-500'}`}>
                            {formatCurrency(paid)} / {formatCurrency(total)}
                        </span>
                    </div>
                    {remaining > 0.01 && (
                        <p className="text-xs text-orange-500 text-center">ยอดค้างเหลือ {formatCurrency(remaining)} (สามารถชำระบางส่วนได้)</p>
                    )}
                    <button type="button" onClick={() => onConfirm(lines.map(l => ({
                        method: l.method, amount: l.amount,
                        ...(l.method === 'CREDIT' && l.dueDate ? { dueDate: l.dueDate } : {}),
                    })))}
                        disabled={!isValid || loading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                        {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันชำระหนี้'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Client Component ───
export default function OverdueBillClient({ sale }: { sale: SaleData }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [interestPct, setInterestPct] = useState('');
    const [interestNote, setInterestNote] = useState('');
    const [alert, setAlert] = useState({ open: false, message: '', type: 'success' as 'success' | 'error' | 'warning', title: '' });

    const calculatedInterest = sale.remaining * (parseFloat(interestPct) || 0) / 100;

    const handleAddInterest = async () => {
        const pct = parseFloat(interestPct);
        if (!pct || pct <= 0) { setAlert({ open: true, message: 'กรุณาระบุ % ดอกเบี้ย', type: 'warning', title: 'ข้อมูลไม่ครบ' }); return; }
        setLoading(true);
        try {
            const result = await addInterest(sale.id, pct, interestNote || undefined);
            setAlert({ open: true, message: `เพิ่มดอกเบี้ย ${formatCurrency(result.amount)} สำเร็จ`, type: 'success', title: 'บันทึกดอกเบี้ย' });
            setInterestPct('');
            setInterestNote('');
            router.refresh();
        } catch (err) {
            setAlert({ open: true, message: (err as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setLoading(false); }
    };

    const handlePayDebt = async (payments: { method: string; amount: number; dueDate?: string }[]) => {
        setLoading(true);
        try {
            const result = await payDebt(sale.id, payments);
            setShowPayment(false);
            setAlert({
                open: true,
                message: result.isPaidOff ? 'ชำระหนี้ครบแล้ว! 🎉' : 'บันทึกการชำระหนี้เรียบร้อย',
                type: 'success',
                title: 'ชำระหนี้สำเร็จ!',
            });
            router.refresh();
        } catch (err) {
            setAlert({ open: true, message: (err as Error).message, type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setLoading(false); }
    };

    return (
        <>
            {/* Interest Section */}
            {!sale.isPaidOff && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-700">📊 เพิ่มดอกเบี้ย</h2>
                        <span className="text-[11px] text-gray-400">ยอดค้าง: {formatCurrency(sale.remaining)}</span>
                    </div>
                    <div className="p-4">
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex-1 min-w-[120px]">
                                <label className="text-xs text-gray-500 block mb-1">ดอกเบี้ย (%)</label>
                                <input type="number" value={interestPct}
                                    onChange={e => setInterestPct(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    placeholder="เช่น 1.5" step="0.01" min={0} />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                                <label className="text-xs text-gray-500 block mb-1">จำนวนเงิน</label>
                                <p className="px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-sm font-semibold text-orange-600">
                                    {formatCurrency(calculatedInterest)}
                                </p>
                            </div>
                            <div className="flex-[2] min-w-[180px]">
                                <label className="text-xs text-gray-500 block mb-1">หมายเหตุ</label>
                                <input type="text" value={interestNote}
                                    onChange={e => setInterestNote(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    placeholder="(ไม่บังคับ)" />
                            </div>
                            <button onClick={handleAddInterest} disabled={loading || !interestPct}
                                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 shrink-0">
                                {loading ? '⏳' : '+ เพิ่มดอกเบี้ย'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interest History */}
            {sale.debtInterests.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-700">📈 ประวัติดอกเบี้ย</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {sale.debtInterests.map(di => (
                            <div key={di.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">ดอกเบี้ย {di.percentage}% ของ {formatCurrency(di.baseAmount)}</p>
                                    <p className="text-[11px] text-gray-400">{di.note} · {formatDate(di.createdAt)}</p>
                                </div>
                                <span className="text-sm font-semibold text-orange-500">+{formatCurrency(di.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment History */}
            {sale.debtPayments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-700">💰 ประวัติชำระหนี้</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {sale.debtPayments.map(dp => (
                            <div key={dp.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        {dp.method === 'CASH' ? '💵 เงินสด' : dp.method === 'TRANSFER' ? '🏦 เงินโอน' : '📋 เครดิต'}
                                        {dp.method === 'CREDIT' && dp.dueDate && <span className="text-orange-500 ml-1">(กำหนดใหม่: {formatDate(dp.dueDate)})</span>}
                                    </p>
                                    <p className="text-[11px] text-gray-400">{dp.note || formatDate(dp.paidAt)}</p>
                                </div>
                                <span className={`text-sm font-semibold ${dp.method === 'CREDIT' ? 'text-orange-500' : 'text-emerald-600'}`}>
                                    {dp.method === 'CREDIT' ? '' : '-'}{formatCurrency(dp.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pay Debt Button */}
            {!sale.isPaidOff && (
                <div className="sticky bottom-4">
                    <button onClick={() => setShowPayment(true)}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.99]">
                        💳 ชำระหนี้ ({formatCurrency(sale.remaining)})
                    </button>
                </div>
            )}

            {/* Payment Modal */}
            {showPayment && (
                <DebtPaymentModal
                    total={sale.remaining}
                    loading={loading}
                    onConfirm={handlePayDebt}
                    onClose={() => setShowPayment(false)}
                />
            )}

            <AlertModal open={alert.open} onClose={() => setAlert(prev => ({ ...prev, open: false }))}
                message={alert.message} type={alert.type} title={alert.title} />
        </>
    );
}
