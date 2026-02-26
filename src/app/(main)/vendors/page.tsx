import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import VendorCard from './VendorCard';

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
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ผู้ส่งสินค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลผู้ส่งสินค้า / Supplier ({total} ราย)</p>
                </div>
                <Link
                    href="/vendors/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 text-center"
                >
                    + เพิ่มผู้ส่งสินค้า
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400">ยังไม่มีข้อมูลผู้ส่งสินค้า</div>
                ) : (
                    vendors.map((v) => (
                        <VendorCard key={v.id} v={JSON.parse(JSON.stringify(v))} />
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
