import { prisma } from '@/lib/prisma';
import Link from 'next/link';

interface Props {
    searchParams: Promise<{ page?: string }>;
}

export default async function VendorsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const perPage = 12;

    const where = { deletedAt: null };

    const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
            where,
            include: {
                _count: { select: { goodsReceives: true } },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.vendor.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ผู้ขาย</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลผู้ขาย / Supplier ({total} ราย)</p>
                </div>
                <Link
                    href="/vendors/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 text-center"
                >
                    + เพิ่มผู้ขาย
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400">ยังไม่มีข้อมูลผู้ขาย</div>
                ) : (
                    vendors.map((v) => (
                        <div key={v.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg">
                                        🏢
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">{v.name}</h3>
                                        {v.phone && <p className="text-xs text-gray-400">📞 {v.phone}</p>}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${v.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {v.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                                </span>
                            </div>

                            {v.lineId && (
                                <p className="text-xs text-gray-500 mb-1">💬 LINE: {v.lineId}</p>
                            )}
                            {v.address && (
                                <p className="text-xs text-gray-500 mb-2">📍 {v.address}</p>
                            )}

                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                                <span className="text-xs text-gray-400">นำเข้าสินค้า {v._count.goodsReceives} ครั้ง</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-500">หน้า {page} จาก {totalPages}</p>
                    <div className="flex gap-1">
                        {page > 1 && (
                            <Link href={`/vendors?page=${page - 1}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ก่อนหน้า
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link href={`/vendors?page=${page + 1}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ถัดไป
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
