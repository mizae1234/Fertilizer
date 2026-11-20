export type GrPaymentStatusFilter = 'ALL' | 'PAID' | 'UNPAID';
export type GrDateField = 'receivedDate' | 'createdAt';
export type GrReportViewMode = 'items' | 'vendors' | 'bills';

export const GR_REPORT_DEFAULT_PAGE_SIZE = 20;
export const GR_REPORT_MAX_PAGE_SIZE = 100;

export interface GrFilterOption {
    id: string;
    name: string;
}

export interface GoodsReceiveReportOptions {
    vendors: GrFilterOption[];
    warehouses: GrFilterOption[];
}

export interface GoodsReceiveReportFilters {
    dateFrom?: string;
    dateTo?: string;
    dateField?: GrDateField;
    vendorId?: string;
    warehouseId?: string;
    paymentStatus?: GrPaymentStatusFilter;
    productSearch?: string;
    docSearch?: string;
    view?: GrReportViewMode;
    page?: number;
    productSummaryPage?: number;
    pageSize?: number;
    exportAll?: boolean;
}

export interface GoodsReceiveKpiSummary {
    billCount: number;
    vendorCount: number;
    itemLineCount: number;
    distinctProductCount: number;
    totalQuantity: number;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    paidNetAmount: number;
    unpaidNetAmount: number;
    unpaidBillCount: number;
    shippingTotal: number;
    unloadingTotal: number;
    hasItemLevelFilter: boolean;
}

export interface GrReportItemRow {
    itemId: string;
    grId: string;
    grNumber: string;
    poNumber: string | null;
    date: string;
    vendorId: string;
    vendorName: string;
    productId: string;
    productCode: string;
    productName: string;
    unit: string;
    warehouseId: string;
    warehouseName: string;
    lotNo: string | null;
    quantity: number;
    grossUnitCost: number;
    netUnitCost: number;
    grossTotal: number;
    discountShare: number;
    netTotal: number;
    goodsPaid: boolean;
}

export interface GrProductRollupRow {
    productId: string;
    productCode: string;
    productName: string;
    unit: string;
    receiveCount: number;
    vendorCount: number;
    poNumbers: string[];
    totalQuantity: number;
    avgGrossUnitCost: number;
    avgNetUnitCost: number;
    grossTotal: number;
    discountShare: number;
    netTotal: number;
}

export interface GrVendorSummaryRow {
    vendorId: string;
    vendorName: string;
    billCount: number;
    poNumbers: string[];
    itemLineCount: number;
    totalQuantity: number;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    paidNetAmount: number;
    unpaidNetAmount: number;
    unpaidBillCount: number;
    shippingTotal: number;
    unloadingTotal: number;
}

export interface GrBillSummaryRow {
    grId: string;
    grNumber: string;
    poNumber: string | null;
    receivedDate: string;
    createdAt: string;
    vendorId: string;
    vendorName: string;
    createdByName: string;
    itemCount: number;
    totalQuantity: number;
    itemsPreview: string;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    shippingCost: number;
    unloadingCost: number;
    goodsPaid: boolean;
    shippingPaid: boolean;
    unloadingPaid: boolean;
}

export interface PaginatedSlice<T> {
    rows: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface GoodsReceiveReportResponse {
    summary: GoodsReceiveKpiSummary;
    items?: PaginatedSlice<GrReportItemRow>;
    productRollup?: PaginatedSlice<GrProductRollupRow>;
    vendors?: PaginatedSlice<GrVendorSummaryRow>;
    bills?: PaginatedSlice<GrBillSummaryRow>;
}
