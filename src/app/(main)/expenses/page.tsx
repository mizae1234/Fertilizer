'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getExpenses, deleteExpense } from '@/app/actions/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_COLORS } from '@/lib/constants';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';



interface ExpenseItem {
    id: string;
    expenseNumber: string;
    category: string;
    amount: string | number;
    description: string | null;
    reference: string | null;
    expenseDate: string;
    createdAt: string;
    createdBy: { name: string };
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning'; title?: string }>({ open: false, message: '', type: 'error' });

    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'error', title?: string) => {
        setAlertModal({ open: true, message, type, title });
    }, []);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getExpenses(page, search, category, dateFrom, dateTo);
            setExpenses(JSON.parse(JSON.stringify(data.expenses)));
            setTotalPages(data.totalPages);
            setTotalAmount(Number(data.totalAmount));
            setTotalCount(data.totalCount);
        } catch (error) {
            showAlert('ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, search, category, dateFrom, dateTo, showAlert]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteExpense(deleteId);
            showAlert('ลบรายจ่ายเรียบร้อย', 'success', 'สำเร็จ');
            fetchExpenses();
        } catch (error) {
            showAlert((error as Error).message, 'error', 'เกิดข้อผิดพลาด');
        } finally {
            setDeleteId(null);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
    };

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            <PageHeader
                title="💸 บันทึกรายจ่าย"
                subtitle="จัดการค่าใช้จ่ายในกิจการ"
                actions={
                    <Link href="/expenses/new" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 transition-all">
                        <span className="text-lg">+</span> เพิ่มรายจ่าย
                    </Link>
                }
            />

            {/* Summary Card */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100 p-4 mb-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-500">ยอดรวมรายจ่าย ({totalCount} รายการ)</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(totalAmount)}</p>
                </div>
                <span className="text-3xl">📊</span>
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <form onSubmit={handleSearch} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ค้นหา รายละเอียด, เลขที่, อ้างอิง..."
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                        <select
                            value={category}
                            onChange={e => { setCategory(e.target.value); setPage(1); }}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        >
                            <option value="">ทุกหมวดหมู่</option>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
                        >
                            ค้นหา
                        </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">📅 ช่วงวันที่:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                        <span className="text-xs text-gray-400">ถึง</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                type="button"
                                onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            >
                                ✕ ล้าง
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                {loading ? (
                    <LoadingSpinner />
                ) : expenses.length === 0 ? (
                    <EmptyState icon="💸" title="ไม่พบรายจ่าย" />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <table className="hidden sm:table w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">เลขที่</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">หมวดหมู่</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">รายละเอียด</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">จำนวนเงิน</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">วันที่</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {expenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-gray-800">{exp.expenseNumber}</p>
                                            {exp.reference && <p className="text-xs text-gray-400">อ้างอิง: {exp.reference}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${EXPENSE_CATEGORY_COLORS[exp.category] || EXPENSE_CATEGORY_COLORS['อื่นๆ']}`}>
                                                {exp.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-600 max-w-[200px] truncate">{exp.description || '-'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <p className="text-sm font-semibold text-red-600">{formatCurrency(Number(exp.amount))}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-600">{formatDate(exp.expenseDate)}</p>
                                            <p className="text-xs text-gray-400">โดย {exp.createdBy.name}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setDeleteId(exp.id)}
                                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                                            >
                                                ลบ
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Cards */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {expenses.map(exp => (
                                <div key={exp.id} className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{exp.expenseNumber}</p>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[exp.category] || EXPENSE_CATEGORY_COLORS['อื่นๆ']}`}>
                                                {exp.category}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-red-600">{formatCurrency(Number(exp.amount))}</p>
                                    </div>
                                    {exp.description && <p className="text-xs text-gray-500 mb-1">{exp.description}</p>}
                                    <div className="flex justify-between items-center text-xs text-gray-400">
                                        <span>{formatDate(exp.expenseDate)} · {exp.createdBy.name}</span>
                                        <button
                                            onClick={() => setDeleteId(exp.id)}
                                            className="text-red-500 hover:text-red-700 px-2 py-1 rounded-lg"
                                        >
                                            ลบ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}

            {/* Modals */}
            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="ยืนยันลบรายจ่าย"
                message="ต้องการลบรายจ่ายนี้ใช่หรือไม่?"
                confirmText="ลบ"
                variant="danger"
            />
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
