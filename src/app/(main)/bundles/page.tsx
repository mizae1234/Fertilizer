import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface Props {
    searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function BundlesPage({ searchParams }: Props) {
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
                    { code: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {}),
    };

    const [bundles, total] = await Promise.all([
        prisma.productBundle.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: { select: { name: true, code: true, unit: true } },
                    },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.productBundle.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const merged = { page: String(page), search, ...params };
        if (merged.search) p.set('search', merged.search);
        if (merged.page !== '1') p.set('page', merged.page);
        return `/bundles?${p}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🎁 ชุดสินค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดกลุ่มสินค้าขายเป็นชุด ({total} ชุด)</p>
                </div>
                <Link
                    href="/bundles/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200"
                >
                    + สร้างชุดสินค้า
                </Link>
            </div>

            {/* Search */}
            <form className="mb-4">
                <input
                    name="search"
                    type="text"
                    defaultValue={search}
                    placeholder="ค้นหาชุดสินค้า..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white shadow-sm"
                />
            </form>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">รหัส</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ชื่อชุดสินค้า</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">สินค้าในชุด</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ต้นทุนชุด</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ราคาชุด</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {bundles.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">ไม่พบชุดสินค้า</td>
                                </tr>
                            ) : (
                                bundles.map((bundle) => (
                                    <tr key={bundle.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                            <Link href={`/bundles/${bundle.id}`} className="hover:text-emerald-600">{bundle.code}</Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/bundles/${bundle.id}`}>
                                                <p className="text-sm font-medium text-emerald-700 hover:text-emerald-800">{bundle.name}</p>
                                                {bundle.description && (
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{bundle.description}</p>
                                                )}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5">
                                                {bundle.items.map((item) => (
                                                    <p key={item.id} className="text-xs text-gray-500">
                                                        {item.product.name} <span className="text-gray-400">×{item.quantity} {item.product.unit}</span>
                                                    </p>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(Number(bundle.bundleCost))}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(bundle.bundlePrice))}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bundle.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {bundle.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">หน้า {page} จาก {totalPages}</p>
                        <div className="flex gap-1">
                            {page > 1 && (
                                <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                    ก่อนหน้า
                                </Link>
                            )}
                            {page < totalPages && (
                                <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                    ถัดไป
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
