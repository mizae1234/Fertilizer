/**
 * Tiered & Unit Price Resolution Logic
 * Pure functions for calculating item prices across POS, quotations, and sales.
 */

export interface PriceTierInput {
    id?: string;
    productUnitId?: string | null;
    minQuantity: number;
    price: number | string;
}

export interface ProductUnitInput {
    id: string;
    unitName: string;
    sellingPrice: number | string;
}

export interface CustomerGroupPriceInput {
    customerGroupId: string;
    productUnitId?: string | null;
    price: number | string;
}

export interface ResolvePriceParams {
    quantity: number;
    basePrice: number | string;
    selectedUnitId?: string | null;
    productUnits?: ProductUnitInput[];
    priceTiers?: PriceTierInput[];
    productPrices?: CustomerGroupPriceInput[];
    customerGroupId?: string | null;
}

export interface ResolvedPriceResult {
    unitPrice: number;
    isTierApplied: boolean;
    appliedTier: { minQuantity: number; price: number } | null;
}

/**
 * Resolves the appropriate unit price based on:
 * 1. Quantity-based price tiers for the selected unit (highest matching minQuantity)
 * 2. Customer group specific price for this unit
 * 3. Default unit selling price (or base price for base unit)
 */
export function resolveItemUnitPrice({
    quantity,
    basePrice,
    selectedUnitId,
    productUnits,
    priceTiers,
    productPrices,
    customerGroupId,
}: ResolvePriceParams): ResolvedPriceResult {
    const normBasePrice = Number(basePrice) || 0;
    const normUnitId = selectedUnitId || null;
    const qty = Math.max(1, Number(quantity) || 1);

    // 1. Check quantity price tiers for the selected unit (or base unit if null)
    if (priceTiers && priceTiers.length > 0) {
        const unitTiers = priceTiers
            .filter(t => (t.productUnitId || null) === normUnitId)
            .map(t => ({
                minQuantity: Number(t.minQuantity) || 1,
                price: Number(t.price) || 0,
            }))
            .sort((a, b) => b.minQuantity - a.minQuantity); // Descending order (highest minQty first)

        const matchedTier = unitTiers.find(t => qty >= t.minQuantity);
        if (matchedTier) {
            return {
                unitPrice: matchedTier.price,
                isTierApplied: true,
                appliedTier: matchedTier,
            };
        }
    }

    // 2. Check customer group price for the selected unit
    if (customerGroupId && productPrices && productPrices.length > 0) {
        const groupPrice = productPrices.find(
            p => p.customerGroupId === customerGroupId && (p.productUnitId || null) === normUnitId
        );
        if (groupPrice) {
            return {
                unitPrice: Number(groupPrice.price) || 0,
                isTierApplied: false,
                appliedTier: null,
            };
        }
    }

    // 3. Fallback: Unit selling price or base price
    if (normUnitId && productUnits && productUnits.length > 0) {
        const unit = productUnits.find(u => u.id === normUnitId);
        if (unit) {
            return {
                unitPrice: Number(unit.sellingPrice) || 0,
                isTierApplied: false,
                appliedTier: null,
            };
        }
    }

    return {
        unitPrice: normBasePrice,
        isTierApplied: false,
        appliedTier: null,
    };
}
