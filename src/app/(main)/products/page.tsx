import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Suspense } from 'react';
import ProductFilter from './ProductFilter';

interface Props {
    searchParams: Promise<{ page?: string; search?: string; warehouse?: string; group?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const search = sp.search || '';
    const warehouseFilter = sp.warehouse || '';
    const groupFilter = sp.group || '';
    const perPage = 10;

    const [warehouses, productGroups] = await Promise.all([
        prisma.warehouse.findMany({ orderBy: { name: 'asc' } }),
        prisma.productGroup.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const where = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { code: { contains: search, mode: 'insensitive' as const } },
                    { brand: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {}),
        ...(warehouseFilter
            ? { productStocks: { some: { warehouseId: warehouseFilter } } }
            : {}),
        ...(groupFilter
            ? { productGroupId: groupFilter }
            : {}),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                productGroup: { select: { name: true } },
                productStocks: {
                    select: { warehouseId: true, quantity: true, warehouse: { select: { name: true } } },
                    ...(warehouseFilter ? { where: { warehouseId: warehouseFilter } } : {}),
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const merged = { page: String(page), search, warehouse: warehouseFilter, group: groupFilter, ...params };
        if (merged.search) p.set('search', merged.search);
        if (merged.warehouse) p.set('warehouse', merged.warehouse);
        if (merged.group) p.set('group', merged.group);
        if (merged.page !== '1') p.set('page', merged.page);
        return `/products?${p}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">สินค้า</h1>
                    <p className="text-sm text-gray-500 mt-1">จัดการสินค้าทั้งหมด ({total} รายการ)</p>
                </div>
                <Link
                    href="/products/new"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200"
                >
                    + เพิ่มสินค้า
                </Link>
            </div>

            {/* Filters */}
            <Suspense fallback={<div className="mb-4 h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                <ProductFilter warehouses={warehouses} productGroups={productGroups} />
            </Suspense>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">รหัส</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ชื่อสินค้า</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">หมวดหมู่</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ยี่ห้อ</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ต้นทุน</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ราคาขาย</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">หน่วย</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {warehouseFilter ? `Stock (${warehouses.find(w => w.id === warehouseFilter)?.name || ''})` : 'Stock รวม'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">ไม่พบสินค้า</td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const totalStock = product.productStocks.reduce((s, ps) => s + ps.quantity, 0);
                                    const isLowStock = totalStock < product.minStock;
                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                                <Link href={`/products/${product.id}`} className="hover:text-emerald-600">{product.code}</Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link href={`/products/${product.id}`}>
                                                    <p className="text-sm font-medium text-emerald-700 hover:text-emerald-800">{product.name}</p>
                                                    {product.description && (
                                                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</p>
                                                    )}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {product.productGroup ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">
                                                        {product.productGroup.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{product.brand || <span className="text-gray-300">-</span>}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(Number(product.cost))}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(product.price))}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{product.unit}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                                                    {totalStock.toLocaleString()}
                                                </span>
                                                {isLowStock && (
                                                    <span className="ml-1 text-xs text-red-500">⚠️</span>
                                                )}
                                                {!warehouseFilter && product.productStocks.length > 0 && (
                                                    <div className="mt-1">
                                                        {product.productStocks.map(ps => (
                                                            <span key={ps.warehouseId} className="inline-block mr-1 text-[10px] text-gray-400">
                                                                {ps.warehouse.name}: {ps.quantity}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
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
