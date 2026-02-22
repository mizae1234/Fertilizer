import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Suspense } from 'react';
import CustomerFilter from './CustomerFilter';

interface Props {
    searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const search = sp.search || '';
    const perPage = 10;

    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { phone: { contains: search } },
                ],
            }
            : {}),
    };

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            include: { customerGroup: { select: { name: true } } },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">ลูกค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลลูกค้า ({total} ราย)</p>
                </div>
                <Link
                    href="/customers/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200"
                >
                    + ลงทะเบียนลูกค้า
                </Link>
            </div>

            <Suspense fallback={<div className="mb-4 h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                <CustomerFilter />
            </Suspense>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ชื่อ</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เบอร์โทร</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">กลุ่ม</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">แต้มสะสม</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่สมัคร</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {customers.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">ไม่พบลูกค้า</td></tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                            {c.customerGroup.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{c.totalPoints.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('th-TH')}</td>
                                    <td className="px-4 py-3">
                                        <Link href={`/customers/${c.id}`} className="text-xs text-emerald-600 hover:underline">ดูรายละเอียด</Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">หน้า {page} จาก {totalPages}</p>
                        <div className="flex gap-1">
                            {page > 1 && <Link href={`/customers?page=${page - 1}&search=${search}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ก่อนหน้า</Link>}
                            {page < totalPages && <Link href={`/customers?page=${page + 1}&search=${search}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ถัดไป</Link>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
