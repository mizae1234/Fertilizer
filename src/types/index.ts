import type { Prisma } from '@/generated/prisma/client';

// ==================== Common Utility Types ====================

/** Standard API response wrapper */
export type ApiResponse<T> = {
    data: T;
    error?: string;
};

/** Paginated response */
export type PaginatedResponse<T> = {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

/** Generic select option for dropdowns */
export type SelectOption = {
    value: string;
    label: string;
    disabled?: boolean;
};

// ==================== Product Types ====================

export type ProductWithStock = Prisma.ProductGetPayload<{
    include: {
        productGroup: true;
        productStocks: { include: { warehouse: true } };
        productUnits: true;
        productPrices: { include: { customerGroup: true; productUnit: true } };
    };
}>;

export type ProductBasic = Prisma.ProductGetPayload<{
    include: { productGroup: true };
}>;

// ==================== Customer Types ====================

export type CustomerWithGroup = Prisma.CustomerGetPayload<{
    include: { customerGroup: true };
}>;

// ==================== Sale Types ====================

export type SaleWithDetails = Prisma.SaleGetPayload<{
    include: {
        customer: true;
        createdBy: true;
        items: { include: { product: true; warehouse: true } };
        debtPayments: true;
        debtInterests: true;
    };
}>;

// ==================== Goods Receive Types ====================

export type GoodsReceiveWithDetails = Prisma.GoodsReceiveGetPayload<{
    include: {
        vendor: true;
        createdBy: true;
        items: { include: { product: true; warehouse: true } };
    };
}>;

// ==================== Transfer Types ====================

export type TransferWithDetails = Prisma.StockTransferGetPayload<{
    include: {
        createdBy: true;
        fromWarehouse: true;
        toWarehouse: true;
        items: { include: { product: true; warehouse: true } };
    };
}>;

// ==================== Factory Return Types ====================

export type FactoryReturnWithDetails = Prisma.FactoryReturnGetPayload<{
    include: {
        vendor: true;
        createdBy: true;
        items: { include: { product: true; warehouse: true } };
    };
}>;
