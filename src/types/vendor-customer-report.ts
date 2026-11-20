import type { PaginatedSlice } from './goods-receive-report';

export const VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE = 20;
export const VENDOR_CUSTOMER_MAX_PAGE_SIZE = 100;

export type VendorPromoSubView = 'customers' | 'products';

export interface VendorOptionWithCount {
    id: string;
    name: string;
    productCount: number;
}

export interface VendorCustomerReportOptions {
    vendors: VendorOptionWithCount[];
    brands: string[];
}

export interface VendorCustomerReportFilters {
    dateFrom?: string;
    dateTo?: string;
    vendorId?: string;
    brand?: string;
    customerSearch?: string;
    minSpend?: number;
    minQuantity?: number;
    excludeWalkIn?: boolean;
    subView?: VendorPromoSubView;
    page?: number;
    pageSize?: number;
    exportAll?: boolean;
}

export interface VendorCustomerKpiSummary {
    qualifiedCustomerCount: number;
    totalBillCount: number;
    matchedProductCount: number;
    totalBaseQuantity: number;
    totalNetSales: number;
    totalCogs: number;
    totalGrossProfit: number;
    grossMarginPct: number;
}

export interface VendorCustomerRankRow {
    rank: number;
    customerKey: string; // customer.id or '__WALK_IN__'
    customerId: string | null;
    isWalkIn: boolean;
    customerName: string;
    phone: string | null;
    customerGroupName: string;
    totalPoints: number;
    billCount: number;
    distinctProductCount: number;
    totalBaseQuantity: number;
    netSales: number;
    salesSharePct: number;
    cogs: number;
    grossProfit: number;
    lastPurchaseAt: string;
}

export interface VendorProductSalesRow {
    productId: string;
    productCode: string;
    productName: string;
    brand: string | null;
    baseUnit: string;
    sourcedVendors: string[];
    buyerCount: number;
    billCount: number;
    totalBaseQuantity: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
}

export interface CustomerVendorProductBreakdownRow {
    productId: string;
    productCode: string;
    productName: string;
    baseUnit: string;
    sourcedVendors: string[];
    billCount: number;
    totalBaseQuantity: number;
    netSales: number;
    grossProfit: number;
}

export interface CustomerVendorExportDetailRow {
    rank: number;
    customerName: string;
    phone: string;
    customerGroupName: string;
    productCode: string;
    productName: string;
    baseUnit: string;
    sourcedVendors: string;
    billCount: number;
    totalBaseQuantity: number;
    netSales: number;
    grossProfit: number;
}

export interface VendorCustomerReportResponse {
    requiresSelection: boolean;
    summary: VendorCustomerKpiSummary;
    customers?: PaginatedSlice<VendorCustomerRankRow>;
    products?: PaginatedSlice<VendorProductSalesRow>;
    exportDetails?: CustomerVendorExportDetailRow[];
}
