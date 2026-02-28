import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import WarehouseCard from './WarehouseCard';

interface Props {
    searchParams: Promise<{ page?: string }>;
}

export default async function WarehousesPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const perPage = 12;

    const where = { deletedAt: null };

    const [warehouses, total] = await Promise.all([
        prisma.warehouse.findMany({
            where,
            select: {
                id: true, name: true, location: true, isActive: true, createdAt: true,
                _count: { select: { productStocks: true } },
                productStocks: {
                    select: { quantity: true },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.warehouse.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">คลังสินค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการคลังสินค้าทั้งหมด ({total} คลัง)</p>
                </div>
                <Link
                    href="/warehouses/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200"
                >
                    + เพิ่มคลังสินค้า
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((wh) => (
                    <WarehouseCard key={wh.id} wh={JSON.parse(JSON.stringify(wh))} />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-500">หน้า {page} จาก {totalPages}</p>
                    <div className="flex gap-1">
                        {page > 1 && (
                            <Link href={`/warehouses?page=${page - 1}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ก่อนหน้า
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link href={`/warehouses?page=${page + 1}`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                ถัดไป
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
