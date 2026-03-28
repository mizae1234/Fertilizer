import { prisma } from '@/lib/prisma';

// Prefix-to-table mapping for running number lookup
const PREFIX_TABLE_MAP: Record<string, { table: string; column: string }> = {
    SL: { table: 'Sale', column: 'saleNumber' },
    QT: { table: 'Quotation', column: 'quotationNumber' },
    EXP: { table: 'Expense', column: 'expenseNumber' },
    TF: { table: 'StockTransfer', column: 'transferNumber' },
    ADJ: { table: 'StockAdjustment', column: 'adjustmentNumber' },
    GR: { table: 'GoodsReceive', column: 'grNumber' },
    FR: { table: 'FactoryReturn', column: 'returnNumber' },
    RT: { table: 'SaleReturn', column: 'returnNumber' },
    WD: { table: 'StockWithdrawal', column: 'withdrawalNumber' },
};

/**
 * Generate a running number in format: PREFIX-YYYY-XXXXXXXX
 * e.g. SL-2026-00000001, QT-2026-00000001
 */
export async function generateNumber(prefix: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const searchPrefix = `${prefix}-${year}-`;

    const mapping = PREFIX_TABLE_MAP[prefix];
    let lastNumber = 0;

    if (mapping) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (prisma as any)[mapping.table.charAt(0).toLowerCase() + mapping.table.slice(1)].findFirst({
                where: { [mapping.column]: { startsWith: searchPrefix } },
                orderBy: { [mapping.column]: 'desc' },
                select: { [mapping.column]: true },
            });

            if (result) {
                const numStr = (result[mapping.column] as string).replace(searchPrefix, '');
                lastNumber = parseInt(numStr, 10) || 0;
            }
        } catch {
            // Fallback if table doesn't exist yet
        }
    }

    const nextNumber = (lastNumber + 1).toString().padStart(8, '0');
    return `${prefix}-${year}-${nextNumber}`;
}
