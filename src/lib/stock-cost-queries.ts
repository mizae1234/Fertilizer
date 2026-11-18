import type { Prisma } from '@/generated/prisma/client';
import { roundQty } from '@/lib/utils';

type DbWithGoodsReceive = {
    goodsReceive: {
        findMany: (args: {
            where: Prisma.GoodsReceiveWhereInput;
            select: { grNumber: true };
        }) => Promise<{ grNumber: string }[]>;
    };
};

/**
 * Fetch unique `grNumber` references of all CANCELLED Goods Receives
 * involving any of the given `productIds`.
 */
export async function getCancelledGrNumbers(
    db: DbWithGoodsReceive,
    productIds: string[]
): Promise<string[]> {
    if (productIds.length === 0) return [];
    const cancelledGrs = await db.goodsReceive.findMany({
        where: {
            status: 'CANCELLED',
            items: { some: { productId: { in: productIds } } },
        },
        select: { grNumber: true },
    });
    return cancelledGrs.map(g => g.grNumber);
}

/**
 * Build a Prisma `StockTransactionWhereInput` for active (non-cancelled)
 * positive `GOODS_RECEIVE` rows. Preserves initial stock imports where
 * `reference` is `null` while excluding cancelled GR references.
 */
export function buildActiveReceiveTxWhere(params: {
    productId: string;
    warehouseId?: string;
    cancelledRefs: string[];
}): Prisma.StockTransactionWhereInput {
    const { productId, warehouseId, cancelledRefs } = params;
    return {
        productId,
        ...(warehouseId ? { warehouseId } : {}),
        type: 'GOODS_RECEIVE',
        quantity: { gt: 0 },
        ...(cancelledRefs.length > 0
            ? {
                  OR: [
                      { reference: null },
                      { reference: { notIn: cancelledRefs } },
                  ],
              }
            : {}),
    };
}

export interface CostSample {
    quantity: number;
    unitCost: number | Prisma.Decimal | string;
}

/**
 * Compute weighted average unit cost rounded to 2 decimal places.
 */
export function computeWeightedAvgCost(samples: CostSample[]): number {
    if (samples.length === 0) return 0;
    const totalQty = samples.reduce((sum, s) => sum + Number(s.quantity), 0);
    if (totalQty <= 0) return 0;
    const totalValue = samples.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unitCost), 0);
    return Math.round((totalValue / totalQty) * 100) / 100;
}

/**
 * Pick the most recent unit cost from `samples` (ordered newest-first),
 * preferring a positive cost when mixed with 0-cost freebies in the same latest batch.
 */
export function pickLatestReceiveCost(
    samples: Array<{ unitCost: number | Prisma.Decimal | string; reference?: string | null }>
): number {
    if (samples.length === 0) return 0;
    const latest = samples[0];
    if (Number(latest.unitCost) > 0) {
        return Math.round(Number(latest.unitCost) * 100) / 100;
    }
    // If the newest row was a 0-cost freebie line in a multi-line GR, check sibling lines in the same GR first
    if (latest.reference) {
        const sameRefPositive = samples.find(
            s => s.reference === latest.reference && Number(s.unitCost) > 0
        );
        if (sameRefPositive) {
            return Math.round(Number(sameRefPositive.unitCost) * 100) / 100;
        }
    }
    return Math.round(Number(latest.unitCost) * 100) / 100;
}

/**
 * Compute Goods Receive subtotal, clamped bill-level discount, net totalAmount,
 * and the proportional net cost multiplier (`(subtotal - discount) / subtotal`).
 */
export function computeGrBillTotals(
    items: CostSample[],
    rawDiscount?: number | Prisma.Decimal | string | null
): {
    subtotal: number;
    discount: number;
    netTotalAmount: number;
    discountRatio: number;
} {
    const subtotal = Math.round(
        items.reduce((sum, item) => sum + roundQty(Number(item.quantity)) * Number(item.unitCost), 0) * 100
    ) / 100;
    const parsedDiscount = Math.round((Number(rawDiscount) || 0) * 100) / 100;
    const discount = Math.min(subtotal, Math.max(0, parsedDiscount));
    const netTotalAmount = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
    const discountRatio = subtotal > 0 && discount > 0 ? (subtotal - discount) / subtotal : 1;

    return { subtotal, discount, netTotalAmount, discountRatio };
}

/**
 * Compute proportional effective unit cost after deducting bill-level GR discount.
 */
export function computeEffectiveGrUnitCost(
    rawUnitCost: number | Prisma.Decimal | string,
    discountRatio: number
): number {
    return Number(rawUnitCost) * discountRatio;
}

