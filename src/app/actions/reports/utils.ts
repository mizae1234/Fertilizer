// Shared helper for building date range filters
// Extracted from 'use server' files since non-async functions cannot be exported from Server Action modules

export function getDateRange(dateFrom?: string, dateTo?: string) {
    const filter: Record<string, unknown> = {};
    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filter.lte = to;
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
}
