'use server';

import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { isServerAdmin } from '@/lib/server-auth';
import { roundQty } from '@/lib/utils';
import { computeEffectiveGrUnitCost } from '@/lib/stock-cost-queries';
import { getDateRange } from './utils';
import {
    GR_REPORT_DEFAULT_PAGE_SIZE,
    GR_REPORT_MAX_PAGE_SIZE,
    type GoodsReceiveReportFilters,
    type GoodsReceiveReportOptions,
    type GoodsReceiveReportResponse,
    type GrBillSummaryRow,
    type GrProductRollupRow,
    type GrReportItemRow,
    type GrVendorSummaryRow,
    type PaginatedSlice,
} from '@/types/goods-receive-report';

const roundMoney = (val: number): number => Math.round(val * 100) / 100;

async function ensureAdminAccess(): Promise<void> {
    if (!(await isServerAdmin())) {
        throw new Error('ไม่มีสิทธิ์เข้าถึงข้อมูล (เฉพาะผู้ดูแลระบบ ADMIN เท่านั้น)');
    }
}

function tokenizeSearch(raw?: string): string[] {
    if (!raw) return [];
    return raw.trim().split(/\s+/).filter(Boolean);
}

function buildProductTokenWhere(tokens: string[]): Prisma.ProductWhereInput | undefined {
    if (tokens.length === 0) return undefined;
    return {
        AND: tokens.map((token) => {
            const paddedCode = /^\d+$/.test(token) ? token.padStart(5, '0') : null;
            const orClauses: Prisma.ProductWhereInput[] = [
                { name: { contains: token, mode: 'insensitive' } },
                { code: { contains: token, mode: 'insensitive' } },
                { barcode: { contains: token, mode: 'insensitive' } },
                { brand: { contains: token, mode: 'insensitive' } },
            ];
            if (paddedCode && paddedCode !== token) {
                orClauses.push({ code: { contains: paddedCode, mode: 'insensitive' } });
            }
            return { OR: orClauses };
        }),
    };
}

function buildItemWhere(
    warehouseId?: string,
    productWhere?: Prisma.ProductWhereInput
): Prisma.GoodsReceiveItemWhereInput | undefined {
    if (!warehouseId && !productWhere) return undefined;
    return {
        ...(warehouseId ? { warehouseId } : {}),
        ...(productWhere ? { product: productWhere } : {}),
    };
}

function buildGoodsReceiveWhere(filters: GoodsReceiveReportFilters): {
    grWhere: Prisma.GoodsReceiveWhereInput;
    itemWhere?: Prisma.GoodsReceiveItemWhereInput;
    hasItemLevelFilter: boolean;
} {
    const dateField = filters.dateField === 'createdAt' ? 'createdAt' : 'receivedDate';
    const dateRange = getDateRange(filters.dateFrom, filters.dateTo);
    const productTokens = tokenizeSearch(filters.productSearch);
    const docTokens = tokenizeSearch(filters.docSearch);

    const productWhere = buildProductTokenWhere(productTokens);
    const itemWhere = buildItemWhere(filters.warehouseId || undefined, productWhere);
    const hasItemLevelFilter = Boolean(filters.warehouseId || productTokens.length > 0);

    const andConditions: Prisma.GoodsReceiveWhereInput[] = [];

    if (docTokens.length > 0) {
        for (const token of docTokens) {
            andConditions.push({
                OR: [
                    { grNumber: { contains: token, mode: 'insensitive' } },
                    { poNumber: { contains: token, mode: 'insensitive' } },
                    { vendor: { name: { contains: token, mode: 'insensitive' } } },
                    { notes: { contains: token, mode: 'insensitive' } },
                ],
            });
        }
    }

    if (itemWhere) {
        andConditions.push({ items: { some: itemWhere } });
    }

    const grWhere: Prisma.GoodsReceiveWhereInput = {
        status: 'APPROVED',
        deletedAt: null,
        ...(dateRange ? { [dateField]: dateRange } : {}),
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.paymentStatus === 'PAID'
            ? { goodsPaid: true }
            : filters.paymentStatus === 'UNPAID'
              ? { goodsPaid: false }
              : {}),
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    return { grWhere, itemWhere, hasItemLevelFilter };
}

function paginateArray<T>(
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
    const safePageSize = Math.min(GR_REPORT_MAX_PAGE_SIZE, Math.max(1, pageSize));
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

/**
 * Compute proportional bill-wide net cost multiplier from the GoodsReceive header.
 * Since `totalAmount = fullBillGross - discount` on GoodsReceive headers,
 * `fullBillGross = totalAmount + discount`, which stays exact even when only a subset
 * of items in the GR is selected by product/warehouse filters.
 */
function resolveHeaderDiscountRatio(
    headerNetAmount: number,
    headerDiscount: number
): number {
    if (headerDiscount <= 0) return 1;
    const fullBillGross = headerNetAmount + headerDiscount;
    if (fullBillGross <= 0) return 1;
    return Math.max(0, Math.min(1, headerNetAmount / fullBillGross));
}

export async function getGoodsReceiveReportOptions(): Promise<GoodsReceiveReportOptions> {
    await ensureAdminAccess();

    const [vendors, warehouses] = await Promise.all([
        prisma.vendor.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
        prisma.warehouse.findMany({
            where: { deletedAt: null, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    return { vendors, warehouses };
}

export async function getGoodsReceiveReport(
    filters: GoodsReceiveReportFilters = {}
): Promise<GoodsReceiveReportResponse> {
    await ensureAdminAccess();

    const dateField = filters.dateField === 'createdAt' ? 'createdAt' : 'receivedDate';
    const view = filters.view || 'items';
    const page = filters.page || 1;
    const productSummaryPage = filters.productSummaryPage || 1;
    const pageSize = filters.pageSize || GR_REPORT_DEFAULT_PAGE_SIZE;
    const exportAll = Boolean(filters.exportAll);

    const { grWhere, itemWhere, hasItemLevelFilter } = buildGoodsReceiveWhere(filters);

    const records = await prisma.goodsReceive.findMany({
        where: grWhere,
        select: {
            id: true,
            grNumber: true,
            poNumber: true,
            receivedDate: true,
            createdAt: true,
            discount: true,
            totalAmount: true,
            goodsPaid: true,
            shippingPaid: true,
            shippingCost: true,
            unloadingPaid: true,
            unloadingCost: true,
            vendor: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
            items: {
                ...(itemWhere ? { where: itemWhere } : {}),
                select: {
                    id: true,
                    quantity: true,
                    unitCost: true,
                    totalCost: true,
                    lotNo: true,
                    product: { select: { id: true, code: true, name: true, unit: true } },
                    warehouse: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [{ [dateField]: 'desc' }, { createdAt: 'desc' }],
    });

    // Single-pass O(N) aggregation across matching GRs & items
    let itemLineCount = 0;
    let totalQuantity = 0;
    let grossAmount = 0;
    let discountAmount = 0;
    let netAmount = 0;
    let paidNetAmount = 0;
    let unpaidNetAmount = 0;
    let unpaidBillCount = 0;
    let shippingTotal = 0;
    let unloadingTotal = 0;

    const vendorIdSet = new Set<string>();
    const productIdSet = new Set<string>();

    const needItems = view === 'items';
    const needVendors = view === 'vendors';
    const needBills = view === 'bills';

    const itemRows: GrReportItemRow[] = [];
    const productRollupMap = new Map<
        string,
        {
            productId: string;
            productCode: string;
            productName: string;
            unit: string;
            receiveCount: number;
            vendorIds: Set<string>;
            poSet: Set<string>;
            totalQuantity: number;
            grossTotal: number;
            discountShare: number;
            netTotal: number;
        }
    >();

    const vendorMap = new Map<string, GrVendorSummaryRow & { poSet: Set<string> }>();
    const billRows: GrBillSummaryRow[] = [];

    for (const gr of records) {
        if (gr.items.length === 0 && hasItemLevelFilter) continue;

        vendorIdSet.add(gr.vendor.id);
        const cleanPo = gr.poNumber?.trim() || null;
        const headerNet = Number(gr.totalAmount);
        const headerDiscount = Number(gr.discount);
        const discountRatio = resolveHeaderDiscountRatio(headerNet, headerDiscount);
        const grShipping = Number(gr.shippingCost);
        const grUnloading = Number(gr.unloadingCost);
        const displayDateIso = (dateField === 'createdAt' ? gr.createdAt : gr.receivedDate).toISOString();

        shippingTotal += grShipping;
        unloadingTotal += grUnloading;
        if (!gr.goodsPaid) unpaidBillCount++;

        let billMatchedQty = 0;
        let billMatchedGross = 0;
        let billMatchedNet = 0;

        for (const item of gr.items) {
            const qty = roundQty(item.quantity);
            const rawUnitCost = Number(item.unitCost);
            const lineGross = roundMoney(qty * rawUnitCost);
            const effectiveUnitCost = computeEffectiveGrUnitCost(rawUnitCost, discountRatio);
            const lineNet = roundMoney(qty * effectiveUnitCost);
            const lineDiscountShare = roundMoney(Math.max(0, lineGross - lineNet));

            itemLineCount++;
            productIdSet.add(item.product.id);
            billMatchedQty = roundQty(billMatchedQty + qty);
            billMatchedGross += lineGross;
            billMatchedNet += lineNet;

            if (needItems) {
                itemRows.push({
                    itemId: item.id,
                    grId: gr.id,
                    grNumber: gr.grNumber,
                    poNumber: cleanPo,
                    date: displayDateIso,
                    vendorId: gr.vendor.id,
                    vendorName: gr.vendor.name,
                    productId: item.product.id,
                    productCode: item.product.code,
                    productName: item.product.name,
                    unit: item.product.unit,
                    warehouseId: item.warehouse.id,
                    warehouseName: item.warehouse.name,
                    lotNo: item.lotNo,
                    quantity: qty,
                    grossUnitCost: roundMoney(rawUnitCost),
                    netUnitCost: roundMoney(effectiveUnitCost),
                    grossTotal: lineGross,
                    discountShare: lineDiscountShare,
                    netTotal: lineNet,
                    goodsPaid: gr.goodsPaid,
                });

                const existingProd = productRollupMap.get(item.product.id);
                if (existingProd) {
                    existingProd.receiveCount += 1;
                    existingProd.vendorIds.add(gr.vendor.id);
                    if (cleanPo) existingProd.poSet.add(cleanPo);
                    existingProd.totalQuantity = roundQty(existingProd.totalQuantity + qty);
                    existingProd.grossTotal = roundMoney(existingProd.grossTotal + lineGross);
                    existingProd.discountShare = roundMoney(existingProd.discountShare + lineDiscountShare);
                    existingProd.netTotal = roundMoney(existingProd.netTotal + lineNet);
                } else {
                    productRollupMap.set(item.product.id, {
                        productId: item.product.id,
                        productCode: item.product.code,
                        productName: item.product.name,
                        unit: item.product.unit,
                        receiveCount: 1,
                        vendorIds: new Set([gr.vendor.id]),
                        poSet: new Set(cleanPo ? [cleanPo] : []),
                        totalQuantity: qty,
                        grossTotal: lineGross,
                        discountShare: lineDiscountShare,
                        netTotal: lineNet,
                    });
                }
            }
        }

        // When no item-level filter is active, use exact header totals to avoid 1-satang rounding drift across lines
        const effectiveBillGross = hasItemLevelFilter
            ? roundMoney(billMatchedGross)
            : roundMoney(headerNet + headerDiscount);
        const effectiveBillNet = hasItemLevelFilter
            ? roundMoney(billMatchedNet)
            : roundMoney(headerNet);
        const effectiveBillDiscount = hasItemLevelFilter
            ? roundMoney(Math.max(0, effectiveBillGross - effectiveBillNet))
            : roundMoney(headerDiscount);

        totalQuantity = roundQty(totalQuantity + billMatchedQty);
        grossAmount = roundMoney(grossAmount + effectiveBillGross);
        discountAmount = roundMoney(discountAmount + effectiveBillDiscount);
        netAmount = roundMoney(netAmount + effectiveBillNet);

        if (gr.goodsPaid) {
            paidNetAmount = roundMoney(paidNetAmount + effectiveBillNet);
        } else {
            unpaidNetAmount = roundMoney(unpaidNetAmount + effectiveBillNet);
        }

        if (needVendors) {
            const existingVendor = vendorMap.get(gr.vendor.id);
            if (existingVendor) {
                existingVendor.billCount += 1;
                if (cleanPo) existingVendor.poSet.add(cleanPo);
                existingVendor.itemLineCount += gr.items.length;
                existingVendor.totalQuantity = roundQty(existingVendor.totalQuantity + billMatchedQty);
                existingVendor.grossAmount = roundMoney(existingVendor.grossAmount + effectiveBillGross);
                existingVendor.discountAmount = roundMoney(existingVendor.discountAmount + effectiveBillDiscount);
                existingVendor.netAmount = roundMoney(existingVendor.netAmount + effectiveBillNet);
                if (gr.goodsPaid) {
                    existingVendor.paidNetAmount = roundMoney(existingVendor.paidNetAmount + effectiveBillNet);
                } else {
                    existingVendor.unpaidNetAmount = roundMoney(existingVendor.unpaidNetAmount + effectiveBillNet);
                    existingVendor.unpaidBillCount += 1;
                }
                existingVendor.shippingTotal = roundMoney(existingVendor.shippingTotal + grShipping);
                existingVendor.unloadingTotal = roundMoney(existingVendor.unloadingTotal + grUnloading);
            } else {
                vendorMap.set(gr.vendor.id, {
                    vendorId: gr.vendor.id,
                    vendorName: gr.vendor.name,
                    billCount: 1,
                    poNumbers: [],
                    poSet: new Set(cleanPo ? [cleanPo] : []),
                    itemLineCount: gr.items.length,
                    totalQuantity: billMatchedQty,
                    grossAmount: effectiveBillGross,
                    discountAmount: effectiveBillDiscount,
                    netAmount: effectiveBillNet,
                    paidNetAmount: gr.goodsPaid ? effectiveBillNet : 0,
                    unpaidNetAmount: gr.goodsPaid ? 0 : effectiveBillNet,
                    unpaidBillCount: gr.goodsPaid ? 0 : 1,
                    shippingTotal: roundMoney(grShipping),
                    unloadingTotal: roundMoney(grUnloading),
                });
            }
        }

        if (needBills) {
            const previewParts = gr.items
                .slice(0, 3)
                .map((it) => `${it.product.name} (${roundQty(it.quantity)} ${it.product.unit})`);
            const itemsPreview =
                gr.items.length > 3
                    ? `${previewParts.join(', ')} +อีก ${gr.items.length - 3} รายการ`
                    : previewParts.join(', ');

            billRows.push({
                grId: gr.id,
                grNumber: gr.grNumber,
                poNumber: cleanPo,
                receivedDate: gr.receivedDate.toISOString(),
                createdAt: gr.createdAt.toISOString(),
                vendorId: gr.vendor.id,
                vendorName: gr.vendor.name,
                createdByName: gr.createdBy.name,
                itemCount: gr.items.length,
                totalQuantity: billMatchedQty,
                itemsPreview,
                grossAmount: effectiveBillGross,
                discountAmount: effectiveBillDiscount,
                netAmount: effectiveBillNet,
                shippingCost: roundMoney(grShipping),
                unloadingCost: roundMoney(grUnloading),
                goodsPaid: gr.goodsPaid,
                shippingPaid: gr.shippingPaid,
                unloadingPaid: gr.unloadingPaid,
            });
        }
    }

    const summary = {
        billCount: records.length,
        vendorCount: vendorIdSet.size,
        itemLineCount,
        distinctProductCount: productIdSet.size,
        totalQuantity,
        grossAmount,
        discountAmount,
        netAmount,
        paidNetAmount,
        unpaidNetAmount,
        unpaidBillCount,
        shippingTotal: roundMoney(shippingTotal),
        unloadingTotal: roundMoney(unloadingTotal),
        hasItemLevelFilter,
    };

    if (needItems) {
        const productRollupRows: GrProductRollupRow[] = Array.from(productRollupMap.values())
            .map((p) => ({
                productId: p.productId,
                productCode: p.productCode,
                productName: p.productName,
                unit: p.unit,
                receiveCount: p.receiveCount,
                vendorCount: p.vendorIds.size,
                poNumbers: Array.from(p.poSet),
                totalQuantity: p.totalQuantity,
                avgGrossUnitCost: p.totalQuantity > 0 ? roundMoney(p.grossTotal / p.totalQuantity) : 0,
                avgNetUnitCost: p.totalQuantity > 0 ? roundMoney(p.netTotal / p.totalQuantity) : 0,
                grossTotal: p.grossTotal,
                discountShare: p.discountShare,
                netTotal: p.netTotal,
            }))
            .sort((a, b) => b.netTotal - a.netTotal);

        return {
            summary,
            items: paginateArray(itemRows, page, pageSize, exportAll),
            productRollup: paginateArray(productRollupRows, productSummaryPage, 10, exportAll),
        };
    }

    if (needVendors) {
        const sortedVendors: GrVendorSummaryRow[] = Array.from(vendorMap.values())
            .map(({ poSet, ...rest }) => ({
                ...rest,
                poNumbers: Array.from(poSet),
            }))
            .sort((a, b) => b.netAmount - a.netAmount);
        return {
            summary,
            vendors: paginateArray(sortedVendors, page, pageSize, exportAll),
        };
    }

    return {
        summary,
        bills: paginateArray(billRows, page, pageSize, exportAll),
    };
}

/**
 * Lazy drilldown when clicking a specific Vendor row in the Vendors summary view.
 * Returns matching bills for that single vendor under the current active filters.
 */
export async function getVendorGoodsReceiveBills(
    vendorId: string,
    filters: Omit<GoodsReceiveReportFilters, 'vendorId' | 'view' | 'page' | 'exportAll'>
): Promise<GrBillSummaryRow[]> {
    await ensureAdminAccess();
    const res = await getGoodsReceiveReport({
        ...filters,
        vendorId,
        view: 'bills',
        exportAll: true,
    });
    return res.bills?.rows ?? [];
}
