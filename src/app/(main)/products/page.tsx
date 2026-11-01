import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Suspense } from 'react';
import ProductFilter from './ProductFilter';
import ExportProductsButton from './ExportProductsButton';
import ImportProductsButton from './ImportProductsButton';
import ProductsTable from './ProductsTable';
import { isServerAdmin } from '@/lib/server-auth';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';

interface Props {
    searchParams: Promise<{ page?: string; search?: string; warehouse?: string; group?: string; sort?: string; order?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
    const sp = await searchParams;
    const adminUser = await isServerAdmin();
    const page = parseInt(sp.page || '1');
    const search = sp.search || '';
    const warehouseFilter = sp.warehouse || '';
    const groupFilter = sp.group || '';
    const sort = sp.sort || 'createdAt';
    const order = sp.order || 'desc';
    const perPage = 10;

    const [warehouses, productGroups, brandsData] = await Promise.all([
        prisma.warehouse.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: 'asc' } }),
        prisma.productGroup.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.product.findMany({
            where: { brand: { not: null }, deletedAt: null },
            select: { brand: true },
            distinct: ['brand'],
            orderBy: { brand: 'asc' },
        }),
    ]);
    const availableBrands = brandsData.map(b => b.brand).filter(Boolean) as string[];

    const searchTokens = search.trim().split(/\s+/).filter(Boolean);
    const where = {
        deletedAt: null,
        ...(searchTokens.length > 0
            ? {
                AND: searchTokens.map(token => {
                    const paddedToken = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
                    return {
                        OR: [
                            { name: { contains: token, mode: 'insensitive' as const } },
                            { code: { contains: token, mode: 'insensitive' as const } },
                            ...(paddedToken !== token ? [{ code: { contains: paddedToken, mode: 'insensitive' as const } }] : []),
                            { barcode: { contains: token, mode: 'insensitive' as const } },
                            { brand: { contains: token, mode: 'insensitive' as const } },
                            { packaging: { contains: token, mode: 'insensitive' as const } },
                            { description: { contains: token, mode: 'insensitive' as const } },
                            { productGroup: { name: { contains: token, mode: 'insensitive' as const } } },
                        ],
                    };
                }),
            }
            : {}),
        ...(warehouseFilter
            ? { productStocks: { some: { warehouseId: warehouseFilter, warehouse: { deletedAt: null, isActive: true } } } }
            : {}),
        ...(groupFilter
            ? { productGroupId: groupFilter }
            : {}),
    };

    // Build orderBy from sort param
    const allowedSorts: Record<string, string> = { code: 'code', name: 'name', brand: 'brand', packaging: 'packaging', cost: 'cost', price: 'price', unit: 'unit', createdAt: 'createdAt' };
    const sortField = allowedSorts[sort] || 'createdAt';
    const orderBy = { [sortField]: order === 'asc' ? 'asc' : 'desc' } as any;

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                productGroup: { select: { id: true, name: true } },
                productStocks: {
                    where: {
                        warehouse: { deletedAt: null, isActive: true },
                        ...(warehouseFilter ? { warehouseId: warehouseFilter } : {}),
                    },
                    select: { warehouseId: true, quantity: true, warehouse: { select: { name: true } } },
                    orderBy: [{ warehouse: { isMain: 'desc' } }, { warehouse: { name: 'asc' } }],
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy,
        }),
        prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const serializedProducts = products.map(p => ({
        ...p,
        cost: Number(p.cost),
        price: Number(p.price),
    }));

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="สินค้า"
                subtitle={`จัดการสินค้าทั้งหมด (${total} รายการ)`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/products/barcodes" className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 shadow-xs flex items-center gap-1.5 transition-colors">
                            🏷️ พิมพ์บาร์โค้ด
                        </Link>
                        <ImportProductsButton />
                        <ExportProductsButton />
                        <Link href="/products/new" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                            + เพิ่มสินค้า
                        </Link>
                    </div>
                }
            />

            {/* Filters */}
            <Suspense fallback={<div className="mb-4 h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                <ProductFilter warehouses={warehouses} productGroups={productGroups} />
            </Suspense>

            {/* Interactive Products Table with Inline Editing & Bulk Actions */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <ProductsTable
                    products={serializedProducts}
                    productGroups={productGroups}
                    availableBrands={availableBrands}
                    adminUser={adminUser}
                    warehouseFilter={warehouseFilter}
                    groupFilter={groupFilter}
                    search={search}
                    page={page}
                    sort={sort}
                    order={order}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/products" params={{ search, warehouse: warehouseFilter, group: groupFilter, ...(sort !== 'createdAt' ? { sort } : {}), ...(order !== 'desc' ? { order } : {}) }} />
                )}
            </div>
        </div>
    );
}
