import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Suspense } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import SearchBar from '@/components/SearchBar';
import SalesProductFilter from '@/components/sales/SalesProductFilter';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';

interface Props {
    searchParams: Promise<{
        page?: string;
        status?: string;
        from?: string;
        to?: string;
        search?: string;
        productId?: string;
        productSearch?: string;
    }>;
}

function tokenizeQuery(raw: string): string[] {
    return raw.trim().split(/\s+/).filter(Boolean);
}

function doesProductMatchFilter(
    product: {
        id: string;
        code: string;
        name: string;
        barcode?: string | null;
        brand?: string | null;
    },
    productId: string,
    productTokens: string[]
): boolean {
    if (productId) {
        return product.id === productId;
    }
    if (productTokens.length === 0) {
        return false;
    }
    const lowerName = product.name.toLowerCase();
    const lowerCode = product.code.toLowerCase();
    const lowerBarcode = (product.barcode || '').toLowerCase();
    const lowerBrand = (product.brand || '').toLowerCase();

    return productTokens.every((t) => {
        const token = t.toLowerCase();
        const padded = /^\d+$/.test(token) ? token.padStart(5, '0') : token;
        return (
            lowerName.includes(token) ||
            lowerCode.includes(token) ||
            lowerCode.includes(padded) ||
            lowerBarcode.includes(token) ||
            lowerBrand.includes(token)
        );
    });
}

export default async function SalesPage({ searchParams }: Props) {
    const sp = await searchParams;
    const page = parseInt(sp.page || '1');
    const status = sp.status || '';
    const from = sp.from || '';
    const to = sp.to || '';
    const searchQuery = sp.search || '';
    const productId = sp.productId || '';
    const productSearch = sp.productSearch || '';
    const productTokens = tokenizeQuery(productSearch);
    const hasProductFilter = Boolean(productId || productTokens.length > 0);
    const perPage = 15;

    const andConditions: Prisma.SaleWhereInput[] = [];

    if (searchQuery) {
        const orClauses: Prisma.SaleWhereInput[] = [
            { saleNumber: { contains: searchQuery, mode: 'insensitive' } },
            { customer: { name: { contains: searchQuery, mode: 'insensitive' } } },
            { createdBy: { name: { contains: searchQuery, mode: 'insensitive' } } },
        ];
        const numQuery = Number(searchQuery.replace(/,/g, ''));
        if (!isNaN(numQuery) && searchQuery.trim() !== '') {
            orClauses.push({ totalAmount: { equals: numQuery } });
        }
        andConditions.push({ OR: orClauses });
    }

    if (productId) {
        andConditions.push({
            items: { some: { productId } },
        });
    } else if (productTokens.length > 0) {
        andConditions.push({
            items: {
                some: {
                    product: {
                        AND: productTokens.map((token) => {
                            const padded = /^\d+$/.test(token) ? token.padStart(5, '0') : null;
                            const orTokenClauses: Prisma.ProductWhereInput[] = [
                                { name: { contains: token, mode: 'insensitive' } },
                                { code: { contains: token, mode: 'insensitive' } },
                                { barcode: { contains: token, mode: 'insensitive' } },
                                { brand: { contains: token, mode: 'insensitive' } },
                            ];
                            if (padded && padded !== token) {
                                orTokenClauses.push({ code: { contains: padded, mode: 'insensitive' } });
                            }
                            return { OR: orTokenClauses };
                        }),
                    },
                },
            },
        });
    }

    const where: Prisma.SaleWhereInput = {
        deletedAt: null,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
        ...(from || to
            ? {
                  createdAt: {
                      ...(from ? { gte: new Date(from) } : {}),
                      ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
                  },
              }
            : {}),
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [sales, total, selectedProduct] = await Promise.all([
        prisma.sale.findMany({
            where,
            select: {
                id: true,
                saleNumber: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                customer: { select: { name: true } },
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
                paymentMethod: true,
                payments: true,
                debtPayments: { select: { amount: true, method: true } },
                debtInterests: { select: { amount: true } },
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        unitName: true,
                        product: {
                            select: {
                                id: true,
                                code: true,
                                barcode: true,
                                brand: true,
                                name: true,
                                unit: true,
                                productUnits: { select: { unitName: true, conversionRate: true } },
                            },
                        },
                    },
                },
                saleReturns: {
                    select: { items: { select: { saleItemId: true, quantity: true } } },
                },
            },
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.sale.count({ where }),
        productId
            ? prisma.product.findUnique({
                  where: { id: productId },
                  select: { id: true, code: true, barcode: true, brand: true, name: true, unit: true },
              })
            : Promise.resolve(null),
    ]);

    const totalPages = Math.ceil(total / perPage);

    const buildUrl = (params: Record<string, string>) => {
        const p = new URLSearchParams();
        const vals = {
            page: String(page),
            status,
            from,
            to,
            search: searchQuery,
            productId,
            productSearch,
            ...params,
        };
        Object.entries(vals).forEach(([k, v]) => {
            if (v) p.set(k, v);
        });
        const qs = p.toString();
        return qs ? `/sales?${qs}` : '/sales';
    };

    const paginationParams = Object.fromEntries(
        Object.entries({
            status,
            from,
            to,
            search: searchQuery,
            productId,
            productSearch,
        }).filter(([, v]) => Boolean(v))
    );

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="รายการขาย"
                subtitle={`ทั้งหมด ${total} รายการ`}
                actions={
                    <Link href="/pos" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200">
                        🛒 ไปหน้า POS
                    </Link>
                }
            />

            {/* Status & Date Range Filters */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex gap-1">
                        {[{ v: '', l: 'ทั้งหมด' }, { v: 'APPROVED', l: 'อนุมัติแล้ว' }, { v: 'CANCELLED', l: 'ยกเลิก' }].map(f => (
                            <Link key={f.v} href={buildUrl({ status: f.v, page: '1' })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${status === f.v || (!status && !f.v) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {f.l}
                            </Link>
                        ))}
                    </div>

                    <Suspense fallback={<div className="ml-auto h-9 w-64 bg-gray-100 rounded-lg animate-pulse" />}>
                        <DateRangeFilter />
                    </Suspense>
                </div>
            </div>

            {/* Dual Search Bars: Bill/Customer Search + Product Autocomplete */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            🔍 ค้นหาเลขบิล, ชื่อลูกค้า, พนักงาน หรือมูลค่าบิล
                        </label>
                        <Suspense fallback={<div className="h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                            <SearchBar placeholder="พิมพ์เลขบิล, ชื่อลูกค้า หรือมูลค่าบิล..." />
                        </Suspense>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            📦 ค้นหาตามสินค้า (เลือกจากรายการ หรือกด Enter ค้นคำกว้าง)
                        </label>
                        <Suspense fallback={<div className="h-11 bg-gray-100 rounded-xl animate-pulse" />}>
                            <SalesProductFilter initialProduct={selectedProduct} />
                        </Suspense>
                    </div>
                </div>
            </div>

            {/* Sales Table */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เลขที่</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ลูกค้า</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">รายการสินค้า</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">มูลค่า</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้ทำรายการ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">วันที่</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sales.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">ไม่พบรายการ</td></tr>
                            ) : (
                                sales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link href={`/sales/${sale.id}`} className="text-sm font-medium text-emerald-600 hover:underline">{sale.saleNumber}</Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{sale.customer?.name || 'ลูกค้าทั่วไป'}</td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5">
                                                {(() => {
                                                    const retMap = new Map<string, number>();
                                                    for (const sr of sale.saleReturns) {
                                                        for (const ri of sr.items) {
                                                            retMap.set(ri.saleItemId, (retMap.get(ri.saleItemId) || 0) + ri.quantity);
                                                        }
                                                    }

                                                    const annotated = sale.items.map(item => {
                                                        const netQty = item.quantity - (retMap.get(item.id) || 0);
                                                        const isMatched = hasProductFilter
                                                            ? doesProductMatchFilter(item.product, productId, productTokens)
                                                            : false;
                                                        return { ...item, qty: netQty, isReturnedAll: netQty <= 0, isMatched };
                                                    });

                                                    // Keep active items; if filtering by product and that item was returned, still surface it clearly
                                                    const visiblePool = annotated.filter(item => !item.isReturnedAll || item.isMatched);

                                                    // Surface matched product items to the very top so they are never hidden behind "+X รายการ"
                                                    const ordered = hasProductFilter
                                                        ? [...visiblePool].sort((a, b) => Number(b.isMatched) - Number(a.isMatched))
                                                        : visiblePool;

                                                    const matchedCount = ordered.filter(i => i.isMatched).length;
                                                    const maxDisplay = Math.max(3, matchedCount);

                                                    return (
                                                        <>
                                                            {ordered.slice(0, maxDisplay).map((item, i) => {
                                                                const pu = item.unitName && item.unitName !== item.product.unit
                                                                    ? item.product.productUnits.find(u => u.unitName === item.unitName)
                                                                    : undefined;
                                                                const displayQty = item.isReturnedAll ? item.quantity : item.qty;

                                                                return (
                                                                    <p
                                                                        key={item.id || i}
                                                                        className={
                                                                            item.isMatched
                                                                                ? 'text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block mr-1'
                                                                                : 'text-xs text-gray-500'
                                                                        }
                                                                    >
                                                                        {item.product.name} x{displayQty} {item.unitName || item.product.unit}
                                                                        {pu ? ` (×${Number(pu.conversionRate)})` : ''}
                                                                        {item.isReturnedAll ? ' (คืนสินค้าแล้ว)' : ''}
                                                                    </p>
                                                                );
                                                            })}
                                                            {ordered.length > maxDisplay && (
                                                                <p className="text-xs text-gray-400">+{ordered.length - maxDisplay} รายการ</p>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(Number(sale.totalAmount))}</td>
                                        <td className="px-4 py-3">
                                            {(() => {
                                                if (sale.status === 'CANCELLED') {
                                                    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">🚫 ยกเลิกบิล</span>;
                                                }
                                                const hasCredit = sale.paymentMethod === 'CREDIT' || sale.paymentMethod === 'SPLIT';
                                                if (hasCredit) {
                                                    const payments = (sale.payments && Array.isArray(sale.payments) ? sale.payments : []) as { method: string; amount: number }[];
                                                    const totalInterest = sale.debtInterests.reduce((s, di) => s + Number(di.amount), 0);
                                                    const grandTotal = Number(sale.totalAmount) + totalInterest;
                                                    const initialPaid = payments.filter(p => p.method !== 'CREDIT').reduce((s, p) => s + Number(p.amount), 0);
                                                    const debtPaid = sale.debtPayments.filter(dp => dp.method !== 'CREDIT').reduce((s, dp) => s + Number(dp.amount), 0);
                                                    const totalPaid = initialPaid + debtPaid;
                                                    const remaining = Math.max(0, grandTotal - totalPaid);
                                                    if (remaining > 0) {
                                                        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">⏳ ค้างชำระ</span>;
                                                    }
                                                }
                                                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">✅ ชำระแล้ว</span>;
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{sale.createdBy?.name || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(sale.createdAt)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <Pagination page={page} totalPages={totalPages} basePath="/sales" params={paginationParams} />
                )}
            </div>
        </div>
    );
}
