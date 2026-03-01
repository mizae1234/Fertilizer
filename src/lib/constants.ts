// ==================== Payment Methods ====================
export const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 เงินสด', color: 'emerald' },
    { value: 'TRANSFER', label: '🏦 เงินโอน', color: 'blue' },
    { value: 'CREDIT', label: '📋 เครดิต', color: 'amber' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

export function getPaymentLabel(method: string): string {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function getPaymentColor(method: string): string {
    return PAYMENT_METHODS.find((m) => m.value === method)?.color ?? 'gray';
}

// ==================== Expense Categories ====================
export const EXPENSE_CATEGORIES = [
    'ค่าขนส่ง',
    'ค่าน้ำมัน',
    'ค่าเช่า',
    'ค่าแรง',
    'ค่าสาธารณูปโภค',
    'ค่าซ่อมแซม',
    'อื่นๆ',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
    'ค่าขนส่ง': 'bg-blue-100 text-blue-700',
    'ค่าน้ำมัน': 'bg-orange-100 text-orange-700',
    'ค่าเช่า': 'bg-purple-100 text-purple-700',
    'ค่าแรง': 'bg-green-100 text-green-700',
    'ค่าสาธารณูปโภค': 'bg-cyan-100 text-cyan-700',
    'ค่าซ่อมแซม': 'bg-red-100 text-red-700',
    'อื่นๆ': 'bg-gray-100 text-gray-700',
};

// ==================== Order Statuses ====================
export const ORDER_STATUS_MAP = {
    PENDING: { label: 'รออนุมัติ', color: 'bg-amber-100 text-amber-700', icon: '⏳' },
    APPROVED: { label: 'อนุมัติแล้ว', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
    REJECTED: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700', icon: '❌' },
    CANCELLED: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-600', icon: '🚫' },
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS_MAP;

export function getOrderStatusInfo(status: string) {
    return ORDER_STATUS_MAP[status as OrderStatusKey] ?? { label: status, color: 'bg-gray-100 text-gray-600', icon: '❓' };
}

// ==================== Stock Adjustment Reasons ====================
export const ADJUSTMENT_REASONS = [
    'สินค้าเสียหาย',
    'สินค้าหมดอายุ',
    'สินค้าสูญหาย',
    'นับสต็อกจริง (เพิ่ม)',
    'นับสต็อกจริง (ลด)',
    'อื่นๆ',
] as const;

// ==================== Date Formatting ====================
export const DATE_LOCALE = 'th-TH';
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
};
export const DATETIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    ...DATE_FORMAT_OPTIONS,
    hour: '2-digit',
    minute: '2-digit',
};
