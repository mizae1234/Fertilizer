export function formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const rounded = Math.round((num || 0) * 100) / 100;
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(rounded);
}

export function roundQty(num: number | string): number {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 10000) / 10000;
}

export function formatNumber(num: number | string): string {
    const n = roundQty(num);
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(n);
}

export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Bangkok',
    });
}

export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
}
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}
