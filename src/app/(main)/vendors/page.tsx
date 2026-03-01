import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import VendorCard from './VendorCard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

interface Props {
    searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function VendorsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const searchQuery = sp.search || '';
    const perPage = 12;

    const where: Record<string, unknown> = { deletedAt: null };
    if (searchQuery) {
        where.OR = [
            { name: { contains: searchQuery } },
            { phone: { contains: searchQuery } },
            { contactName: { contains: searchQuery } },
        ];
    }

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
            <PageHeader
                title="ผู้ส่งสินค้า"
                subtitle={`จัดการข้อมูลผู้ส่งสินค้า / Supplier (${total} ราย)`}
                actions={
                    <Link href="/vendors/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 text-center">
                        + เพิ่มผู้ส่งสินค้า
                    </Link>
                }
            />
            {/* Search */}
            <div className="mb-4">
                <form method="get" action="/vendors" className="flex gap-2">
                    <input type="text" name="search" defaultValue={searchQuery}
                        placeholder="🔍 ค้นหาชื่อ, เบอร์โทร, ผู้ติดต่อ..."
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
                    <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600">ค้นหา</button>
                    {searchQuery && <a href="/vendors" className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">ล้าง</a>}
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.length === 0 ? (
                    <div className="col-span-full"><EmptyState icon="🚚" title="ยังไม่มีข้อมูลผู้ส่งสินค้า" /></div>
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
                            <Link href={`/vendors?page=${page - 1}${searchQuery ? `&search=${searchQuery}` : ''}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ก่อนหน้า
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link href={`/vendors?page=${page + 1}${searchQuery ? `&search=${searchQuery}` : ''}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ถัดไป
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
