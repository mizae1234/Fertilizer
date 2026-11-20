'use server';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { isServerAdmin } from '@/lib/server-auth';
import { roundQty } from '@/lib/utils';
import { getDateRange } from './utils';
import type { PaginatedSlice } from '@/types/goods-receive-report';
import {
    VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE,
    VENDOR_CUSTOMER_MAX_PAGE_SIZE,
    type CustomerVendorExportDetailRow,
    type CustomerVendorProductBreakdownRow,
    type VendorCustomerKpiSummary,
    type VendorCustomerRankRow,
    type VendorCustomerReportFilters,
    type VendorCustomerReportOptions,
    type VendorCustomerReportResponse,
    type VendorProductSalesRow,
} from '@/types/vendor-customer-report';

const WALK_IN_CUSTOMER_KEY = '__WALK_IN__';
const roundMoney = (val: number): number => Math.round(val * 100) / 100;

async function ensureAdminAccess(): Promise<void> {
    if (!(await isServerAdmin())) {
        throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูล (เฉพาะผู้ดูแลระบบ ADMIN เท่านั้น)');
    }
}

function paginateSlice<T>(
    allRows: T[],
    page: number,
    pageSize: number,
    exportAll: boolean
): PaginatedSlice<T> {
    const total = allRows.length;
    if (exportAll) {
        return {
            rows: allRows,
            total,
            page: 1,
            pageSize: Math.max(total, 1),
            totalPages: 1,
        };
    }
    const safePageSize = Math.min(VENDOR_CUSTOMER_MAX_PAGE_SIZE, Math.max(1, pageSize));
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * safePageSize;
    return {
        rows: allRows.slice(start, start + safePageSize),
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
    };
}

function emptySummary(): VendorCustomerKpiSummary {
    return {
        qualifiedCustomerCount: 0,
        totalBillCount: 0,
        matchedProductCount: 0,
        totalBaseQuantity: 0,
        totalNetSales: 0,
        totalCogs: 0,
        totalGrossProfit: 0,
        grossMarginPct: 0,
    };
}

/**
 * Resolve eligible Product IDs for the chosen Vendor and/or Brand, plus a map of
 * `productId -> vendorNames[]` across ALL approved GoodsReceives so multi-vendor
 * products clearly display all suppliers they have been purchased from.
 */
async function resolveTargetProductsAndSources(
    vendorId?: string,
    brand?: string
): Promise<{
    targetProductIds: string[];
    sourcedVendorsByProduct: Map<string, string[]>;
}> {
    const trimmedVendorId = (vendorId || '').trim();
    const trimmedBrand = (brand || '').trim();

    if (!trimmedVendorId && !trimmedBrand) {
        return { targetProductIds: [], sourcedVendorsByProduct: new Map() };
    }

    let candidateProductIds: string[] | null = null;

    if (trimmedVendorId) {
        const vendorGrItems = await prisma.goodsReceiveItem.findMany({
            where: {
                goodsReceive: {
                    vendorId: trimmedVendorId,
                    status: 'APPROVED',
                    deletedAt: null,
                },
                ...(trimmedBrand
                    ? {
                          product: {
                              brand: { equals: trimmedBrand, mode: 'insensitive' },
                          },
                      }
                    : {}),
            },
            select: { productId: true },
            distinct: ['productId'],
        });
        candidateProductIds = vendorGrItems.map((row) => row.productId);
    } else if (trimmedBrand) {
        const brandProducts = await prisma.product.findMany({
            where: {
                deletedAt: null,
                brand: { equals: trimmedBrand, mode: 'insensitive' },
            },
            select: { id: true },
        });
        candidateProductIds = brandProducts.map((p) => p.id);
    }

    if (!candidateProductIds || candidateProductIds.length === 0) {
        return { targetProductIds: [], sourcedVendorsByProduct: new Map() };
    }

    // Fetch distinct (productId, vendorName) pairs directly via SQL GROUP BY / DISTINCT
    const allVendorLinks = await prisma.$queryRaw<
        { productId: string; vendorName: string }[]
    >(Prisma.sql`
        SELECT DISTINCT
            gri."productId" AS "productId",
            v.name AS "vendorName"
        FROM "GoodsReceiveItem" gri
        INNER JOIN "GoodsReceive" gr ON gr.id = gri."goodsReceiveId"
        INNER JOIN "Vendor" v ON v.id = gr."vendorId"
        WHERE gri."productId" IN (${Prisma.join(candidateProductIds)})
          AND gr.status = 'APPROVED'
          AND gr."deletedAt" IS NULL
    `);

    const vendorSetMap = new Map<string, Set<string>>();
    for (const link of allVendorLinks) {
        let set = vendorSetMap.get(link.productId);
        if (!set) {
            set = new Set<string>();
            vendorSetMap.set(link.productId, set);
        }
        set.add(link.vendorName);
    }

    const sourcedVendorsByProduct = new Map<string, string[]>();
    for (const [pid, set] of vendorSetMap.entries()) {
        sourcedVendorsByProduct.set(pid, Array.from(set).sort((a, b) => a.localeCompare(b, 'th')));
    }

    return {
        targetProductIds: candidateProductIds,
        sourcedVendorsByProduct,
    };
}

/**
 * Compute proportional sale-level bill discount factor when `Sale.discount > 0`.
 */
function resolveSaleHeaderDiscountRatio(saleNetTotal: number, saleDiscount: number): number {
    if (saleDiscount <= 0) return 1;
    const grossBeforeBillDiscount = saleNetTotal + saleDiscount;
    if (grossBeforeBillDiscount <= 0) return 1;
    return Math.max(0, Math.min(1, saleNetTotal / grossBeforeBillDiscount));
}

export async function getVendorCustomerReportOptions(): Promise<VendorCustomerReportOptions> {
    await ensureAdminAccess();

    const [vendorsRaw, vendorCountsRaw, brandRows] = await Promise.all([
        prisma.vendor.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
        prisma.$queryRaw<{ vendorId: string; productCount: number }[]>(Prisma.sql`
            SELECT
                gr."vendorId" AS "vendorId",
                COUNT(DISTINCT gri."productId")::int AS "productCount"
            FROM "GoodsReceiveItem" gri
            INNER JOIN "GoodsReceive" gr ON gr.id = gri."goodsReceiveId"
            WHERE gr.status = 'APPROVED'
              AND gr."deletedAt" IS NULL
            GROUP BY gr."vendorId"
        `),
        prisma.product.findMany({
            where: {
                deletedAt: null,
                brand: { not: null },
            },
            select: { brand: true },
            distinct: ['brand'],
            orderBy: { brand: 'asc' },
        }),
    ]);

    const productCountMap = new Map<string, number>(
        vendorCountsRaw.map((row) => [row.vendorId, Number(row.productCount || 0)])
    );

    const vendors = vendorsRaw.map((v) => ({
        id: v.id,
        name: v.name,
        productCount: productCountMap.get(v.id) ?? 0,
    }));

    const brands = brandRows
        .map((b) => (b.brand || '').trim())
        .filter(Boolean);

    return { vendors, brands };
}

export async function getVendorCustomerReport(
    filters: VendorCustomerReportFilters = {}
): Promise<VendorCustomerReportResponse> {
    await ensureAdminAccess();

    const trimmedVendorId = (filters.vendorId || '').trim();
    const trimmedBrand = (filters.brand || '').trim();

    if (!trimmedVendorId && !trimmedBrand) {
        return {
            requiresSelection: true,
            summary: emptySummary(),
            customers: paginateSlice([], 1, VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE, false),
            products: paginateSlice([], 1, VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE, false),
        };
    }

    const { targetProductIds, sourcedVendorsByProduct } =
        await resolveTargetProductsAndSources(trimmedVendorId, trimmedBrand);

    if (targetProductIds.length === 0) {
        return {
            requiresSelection: false,
            summary: emptySummary(),
            customers: paginateSlice([], 1, VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE, false),
            products: paginateSlice([], 1, VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE, false),
        };
    }

    const dateRange = getDateRange(filters.dateFrom, filters.dateTo);
    const excludeWalkIn = Boolean(filters.excludeWalkIn);
    const customerSearchTokens = (filters.customerSearch || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const saleWhere: Prisma.SaleWhereInput = {
        status: 'APPROVED',
        deletedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(excludeWalkIn ? { customerId: { not: null } } : {}),
    };

    const saleItems = await prisma.saleItem.findMany({
        where: {
            productId: { in: targetProductIds },
            sale: saleWhere,
        },
        select: {
            id: true,
            saleId: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            unitCost: true,
            totalPrice: true,
            conversionRate: true,
            product: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    brand: true,
                    unit: true,
                },
            },
            sale: {
                select: {
                    id: true,
                    createdAt: true,
                    totalAmount: true,
                    discount: true,
                    customerId: true,
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            totalPoints: true,
                            customerGroup: { select: { name: true } },
                        },
                    },
                    saleReturns: {
                        select: {
                            items: {
                                select: { saleItemId: true, quantity: true },
                            },
                        },
                    },
                },
            },
        },
    });

    // Build SaleReturn quantity lookup once per sale
    const returnedBySaleItem = new Map<string, number>();
    const processedSaleReturnIds = new Set<string>();
    for (const si of saleItems) {
        if (!processedSaleReturnIds.has(si.sale.id)) {
            processedSaleReturnIds.add(si.sale.id);
            for (const sr of si.sale.saleReturns) {
                for (const ri of sr.items) {
                    returnedBySaleItem.set(
                        ri.saleItemId,
                        (returnedBySaleItem.get(ri.saleItemId) || 0) + ri.quantity
                    );
                }
            }
        }
    }

    interface CustomerAcc {
        customerKey: string;
        customerId: string | null;
        isWalkIn: boolean;
        customerName: string;
        phone: string | null;
        customerGroupName: string;
        totalPoints: number;
        saleIds: Set<string>;
        productIds: Set<string>;
        totalBaseQuantity: number;
        netSales: number;
        cogs: number;
        lastPurchaseMs: number;
        perProduct: Map<
            string,
            {
                productId: string;
                productCode: string;
                productName: string;
                baseUnit: string;
                saleIds: Set<string>;
                totalBaseQuantity: number;
                netSales: number;
                cogs: number;
            }
        >;
    }

    const customerMap = new Map<string, CustomerAcc>();

    for (const si of saleItems) {
        const returnedQty = returnedBySaleItem.get(si.id) || 0;
        const remainingSoldUnits = roundQty(si.quantity - returnedQty);
        if (remainingSoldUnits <= 0) continue;

        const cust = si.sale.customer;
        const customerKey = cust?.id ?? WALK_IN_CUSTOMER_KEY;
        const customerName = cust?.name || 'ลูกค้าทั่วไป (ไม่ระบุชื่อ)';
        const phone = cust?.phone || null;
        const groupName = cust?.customerGroup?.name || (cust ? '-' : 'ทั่วไป');

        if (customerSearchTokens.length > 0) {
            const haystack = `${customerName} ${phone || ''} ${groupName} ${si.product.name} ${si.product.code}`.toLowerCase();
            if (!customerSearchTokens.every((tok) => haystack.includes(tok))) {
                continue;
            }
        }

        const rate = Math.max(0.0001, Number(si.conversionRate ?? 1));
        const baseQty = roundQty(remainingSoldUnits * rate);

        const effectiveSoldUnitPrice =
            si.quantity > 0 ? Number(si.totalPrice) / si.quantity : Number(si.unitPrice);
        const saleHeaderRatio = resolveSaleHeaderDiscountRatio(
            Number(si.sale.totalAmount),
            Number(si.sale.discount)
        );
        const lineNetSales = roundMoney(
            remainingSoldUnits * effectiveSoldUnitPrice * saleHeaderRatio
        );
        const lineCogs = roundMoney(baseQty * Number(si.unitCost));
        const saleTimeMs = si.sale.createdAt.getTime();

        let acc = customerMap.get(customerKey);
        if (!acc) {
            acc = {
                customerKey,
                customerId: cust?.id ?? null,
                isWalkIn: !cust,
                customerName,
                phone,
                customerGroupName: groupName,
                totalPoints: cust?.totalPoints ?? 0,
                saleIds: new Set<string>(),
                productIds: new Set<string>(),
                totalBaseQuantity: 0,
                netSales: 0,
                cogs: 0,
                lastPurchaseMs: saleTimeMs,
                perProduct: new Map(),
            };
            customerMap.set(customerKey, acc);
        }

        acc.saleIds.add(si.saleId);
        acc.productIds.add(si.productId);
        acc.totalBaseQuantity = roundQty(acc.totalBaseQuantity + baseQty);
        acc.netSales = roundMoney(acc.netSales + lineNetSales);
        acc.cogs = roundMoney(acc.cogs + lineCogs);
        if (saleTimeMs > acc.lastPurchaseMs) {
            acc.lastPurchaseMs = saleTimeMs;
        }

        let prodAcc = acc.perProduct.get(si.productId);
        if (!prodAcc) {
            prodAcc = {
                productId: si.productId,
                productCode: si.product.code,
                productName: si.product.name,
                baseUnit: si.product.unit,
                saleIds: new Set<string>(),
                totalBaseQuantity: 0,
                netSales: 0,
                cogs: 0,
            };
            acc.perProduct.set(si.productId, prodAcc);
        }
        prodAcc.saleIds.add(si.saleId);
        prodAcc.totalBaseQuantity = roundQty(prodAcc.totalBaseQuantity + baseQty);
        prodAcc.netSales = roundMoney(prodAcc.netSales + lineNetSales);
        prodAcc.cogs = roundMoney(prodAcc.cogs + lineCogs);
    }

    // Apply promo qualification thresholds (minSpend / minQuantity)
    const minSpend = Math.max(0, Number(filters.minSpend) || 0);
    const minQuantity = Math.max(0, Number(filters.minQuantity) || 0);

    const qualifiedCustomers = Array.from(customerMap.values())
        .filter((c) => c.netSales >= minSpend && c.totalBaseQuantity >= minQuantity)
        .sort((a, b) => b.netSales - a.netSales || b.totalBaseQuantity - a.totalBaseQuantity);

    // Aggregate overall KPIs & product rollup strictly across qualified customers so KPIs match the promo table 100%
    const globalSaleIds = new Set<string>();
    const globalProductIds = new Set<string>();
    let totalBaseQuantity = 0;
    let totalNetSales = 0;
    let totalCogs = 0;

    const productRollupMap = new Map<
        string,
        {
            productId: string;
            productCode: string;
            productName: string;
            brand: string | null;
            baseUnit: string;
            buyerKeys: Set<string>;
            saleIds: Set<string>;
            totalBaseQuantity: number;
            netSales: number;
            cogs: number;
        }
    >();

    // Lookup product brand quickly from saleItems
    const productMetaMap = new Map<string, { brand: string | null }>();
    for (const si of saleItems) {
        if (!productMetaMap.has(si.productId)) {
            productMetaMap.set(si.productId, { brand: si.product.brand });
        }
    }

    for (const cust of qualifiedCustomers) {
        for (const sid of cust.saleIds) globalSaleIds.add(sid);
        for (const pid of cust.productIds) globalProductIds.add(pid);
        totalBaseQuantity = roundQty(totalBaseQuantity + cust.totalBaseQuantity);
        totalNetSales = roundMoney(totalNetSales + cust.netSales);
        totalCogs = roundMoney(totalCogs + cust.cogs);

        for (const p of cust.perProduct.values()) {
            let pr = productRollupMap.get(p.productId);
            if (!pr) {
                pr = {
                    productId: p.productId,
                    productCode: p.productCode,
                    productName: p.productName,
                    brand: productMetaMap.get(p.productId)?.brand ?? null,
                    baseUnit: p.baseUnit,
                    buyerKeys: new Set<string>(),
                    saleIds: new Set<string>(),
                    totalBaseQuantity: 0,
                    netSales: 0,
                    cogs: 0,
                };
                productRollupMap.set(p.productId, pr);
            }
            pr.buyerKeys.add(cust.customerKey);
            for (const sid of p.saleIds) pr.saleIds.add(sid);
            pr.totalBaseQuantity = roundQty(pr.totalBaseQuantity + p.totalBaseQuantity);
            pr.netSales = roundMoney(pr.netSales + p.netSales);
            pr.cogs = roundMoney(pr.cogs + p.cogs);
        }
    }

    const totalGrossProfit = roundMoney(totalNetSales - totalCogs);
    const grossMarginPct =
        totalNetSales > 0 ? roundMoney((totalGrossProfit / totalNetSales) * 100) : 0;

    const rankedCustomers: VendorCustomerRankRow[] = qualifiedCustomers.map((c, index) => {
        const grossProfit = roundMoney(c.netSales - c.cogs);
        const sharePct =
            totalNetSales > 0 ? roundMoney((c.netSales / totalNetSales) * 100) : 0;
        return {
            rank: index + 1,
            customerKey: c.customerKey,
            customerId: c.customerId,
            isWalkIn: c.isWalkIn,
            customerName: c.customerName,
            phone: c.phone,
            customerGroupName: c.customerGroupName,
            totalPoints: c.totalPoints,
            billCount: c.saleIds.size,
            distinctProductCount: c.productIds.size,
            totalBaseQuantity: c.totalBaseQuantity,
            netSales: c.netSales,
            salesSharePct: sharePct,
            cogs: c.cogs,
            grossProfit,
            lastPurchaseAt: new Date(c.lastPurchaseMs).toISOString(),
        };
    });

    const productRows: VendorProductSalesRow[] = Array.from(productRollupMap.values())
        .map((p) => ({
            productId: p.productId,
            productCode: p.productCode,
            productName: p.productName,
            brand: p.brand,
            baseUnit: p.baseUnit,
            sourcedVendors: sourcedVendorsByProduct.get(p.productId) || [],
            buyerCount: p.buyerKeys.size,
            billCount: p.saleIds.size,
            totalBaseQuantity: p.totalBaseQuantity,
            netSales: p.netSales,
            cogs: p.cogs,
            grossProfit: roundMoney(p.netSales - p.cogs),
        }))
        .sort((a, b) => b.netSales - a.netSales);

    const page = filters.page || 1;
    const pageSize = filters.pageSize || VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE;
    const exportAll = Boolean(filters.exportAll);
    const subView = filters.subView || 'customers';

    let exportDetails: CustomerVendorExportDetailRow[] | undefined;
    if (exportAll) {
        exportDetails = [];
        qualifiedCustomers.forEach((cust, idx) => {
            const sortedProds = Array.from(cust.perProduct.values()).sort(
                (a, b) => b.netSales - a.netSales
            );
            for (const p of sortedProds) {
                exportDetails!.push({
                    rank: idx + 1,
                    customerName: cust.customerName,
                    phone: cust.phone || '-',
                    customerGroupName: cust.customerGroupName,
                    productCode: p.productCode,
                    productName: p.productName,
                    baseUnit: p.baseUnit,
                    sourcedVendors: (sourcedVendorsByProduct.get(p.productId) || []).join(', ') || '-',
                    billCount: p.saleIds.size,
                    totalBaseQuantity: p.totalBaseQuantity,
                    netSales: p.netSales,
                    grossProfit: roundMoney(p.netSales - p.cogs),
                });
            }
        });
    }

    return {
        requiresSelection: false,
        summary: {
            qualifiedCustomerCount: rankedCustomers.length,
            totalBillCount: globalSaleIds.size,
            matchedProductCount: globalProductIds.size,
            totalBaseQuantity,
            totalNetSales,
            totalCogs,
            totalGrossProfit,
            grossMarginPct,
        },
        customers:
            subView === 'customers' || exportAll
                ? paginateSlice(rankedCustomers, page, pageSize, exportAll)
                : undefined,
        products:
            subView === 'products' || exportAll
                ? paginateSlice(productRows, page, pageSize, exportAll)
                : undefined,
        exportDetails,
    };
}

/**
 * Lazy drilldown when clicking a specific customer row to inspect which products
 * of the selected Vendor/Brand that customer bought.
 */
export async function getCustomerVendorProductBreakdown(
    customerKey: string,
    filters: Omit<VendorCustomerReportFilters, 'page' | 'pageSize' | 'exportAll' | 'subView'>
): Promise<CustomerVendorProductBreakdownRow[]> {
    await ensureAdminAccess();

    const { targetProductIds, sourcedVendorsByProduct } =
        await resolveTargetProductsAndSources(filters.vendorId, filters.brand);
    if (targetProductIds.length === 0) return [];

    const dateRange = getDateRange(filters.dateFrom, filters.dateTo);
    const isWalkIn = customerKey === WALK_IN_CUSTOMER_KEY;

    const saleItems = await prisma.saleItem.findMany({
        where: {
            productId: { in: targetProductIds },
            sale: {
                status: 'APPROVED',
                deletedAt: null,
                ...(dateRange ? { createdAt: dateRange } : {}),
                customerId: isWalkIn ? null : customerKey,
            },
        },
        select: {
            id: true,
            saleId: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            unitCost: true,
            totalPrice: true,
            conversionRate: true,
            product: { select: { id: true, code: true, name: true, unit: true } },
            sale: {
                select: {
                    id: true,
                    totalAmount: true,
                    discount: true,
                    saleReturns: {
                        select: { items: { select: { saleItemId: true, quantity: true } } },
                    },
                },
            },
        },
    });

    const returnedBySaleItem = new Map<string, number>();
    const processedSaleIds = new Set<string>();
    for (const si of saleItems) {
        if (!processedSaleIds.has(si.sale.id)) {
            processedSaleIds.add(si.sale.id);
            for (const sr of si.sale.saleReturns) {
                for (const ri of sr.items) {
                    returnedBySaleItem.set(
                        ri.saleItemId,
                        (returnedBySaleItem.get(ri.saleItemId) || 0) + ri.quantity
                    );
                }
            }
        }
    }

    const perProduct = new Map<
        string,
        {
            productId: string;
            productCode: string;
            productName: string;
            baseUnit: string;
            saleIds: Set<string>;
            totalBaseQuantity: number;
            netSales: number;
            cogs: number;
        }
    >();

    for (const si of saleItems) {
        const returned = returnedBySaleItem.get(si.id) || 0;
        const remaining = roundQty(si.quantity - returned);
        if (remaining <= 0) continue;

        const rate = Math.max(0.0001, Number(si.conversionRate ?? 1));
        const baseQty = roundQty(remaining * rate);
        const effectiveUnitPrice =
            si.quantity > 0 ? Number(si.totalPrice) / si.quantity : Number(si.unitPrice);
        const ratio = resolveSaleHeaderDiscountRatio(
            Number(si.sale.totalAmount),
            Number(si.sale.discount)
        );
        const netSales = roundMoney(remaining * effectiveUnitPrice * ratio);
        const cogs = roundMoney(baseQty * Number(si.unitCost));

        let acc = perProduct.get(si.productId);
        if (!acc) {
            acc = {
                productId: si.productId,
                productCode: si.product.code,
                productName: si.product.name,
                baseUnit: si.product.unit,
                saleIds: new Set<string>(),
                totalBaseQuantity: 0,
                netSales: 0,
                cogs: 0,
            };
            perProduct.set(si.productId, acc);
        }
        acc.saleIds.add(si.saleId);
        acc.totalBaseQuantity = roundQty(acc.totalBaseQuantity + baseQty);
        acc.netSales = roundMoney(acc.netSales + netSales);
        acc.cogs = roundMoney(acc.cogs + cogs);
    }

    return Array.from(perProduct.values())
        .map((p) => ({
            productId: p.productId,
            productCode: p.productCode,
            productName: p.productName,
            baseUnit: p.baseUnit,
            sourcedVendors: sourcedVendorsByProduct.get(p.productId) || [],
            billCount: p.saleIds.size,
            totalBaseQuantity: p.totalBaseQuantity,
            netSales: p.netSales,
            grossProfit: roundMoney(p.netSales - p.cogs),
        }))
        .sort((a, b) => b.netSales - a.netSales);
}
