'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSaleFromPOS } from '@/app/actions/pos';
import { formatCurrency } from '@/lib/utils';
import AlertModal from '@/components/AlertModal';

interface ProductUnitInfo {
    id: string; unitName: string; conversionRate: string; sellingPrice: string; isBaseUnit: boolean;
}
interface Product {
    id: string; code: string; name: string; unit: string; price: string;
    pointsPerUnit: number;
    imageUrl?: string | null;
    productStocks: { warehouseId: string; quantity: number }[];
    productPrices: { customerGroupId: string; price: string; productUnitId: string | null; customerGroup: { id: string; name: string } }[];
    productUnits: ProductUnitInfo[];
}
interface Warehouse { id: string; name: string; }
interface CustomerGroup { id: string; name: string; }
interface Customer { id: string; name: string; phone: string; customerGroup: { id: string; name: string } }
interface BundleInfo {
    id: string; code: string; name: string; description: string | null;
    bundlePrice: string; bundleCost: string; isActive: boolean;
    items: { id: string; productId: string; quantity: number; product: { id: string; name: string; code: string; price: string; unit: string } }[];
}
interface BundleSubItem {
    productId: string; productName: string; productCode: string; unit: string;
    warehouseId: string; quantity: number; unitPrice: number; points: number;
}
interface CartItem {
    productId: string; productName: string; productCode: string; unit: string;
    warehouseId: string; quantity: number; unitPrice: number; points: number;
    availableStock: number; pointsPerUnit: number;
    priceTier: string;
    productPrices: { customerGroupId: string; productUnitId: string | null; price: number }[];
    // Multi-unit fields
    selectedUnitId: string;
    selectedUnitName: string;
    conversionRate: number;
    baseUnitPrice: number; // original base-unit price, never overwritten
    productUnits: ProductUnitInfo[];
    // Bundle fields
    isBundle?: boolean;
    bundleId?: string;
    bundleName?: string;
    bundleItems?: BundleSubItem[];
    // Discount
    itemDiscount: number;
}

interface HeldSale {
    id: string;
    cart: CartItem[];
    customer: Customer | null;
    billDiscount: number;
    notes: string;
    heldAt: string;
    label: string;
}

interface PaymentLine { method: string; amount: number; dueDate: string; bankAccountId?: string }
interface BankAccountInfo { id: string; accountName: string; accountNumber: string; bankName: string; qrCodeUrl: string | null; isDefault: boolean; isActive: boolean }
const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 เงินสด', color: 'emerald' },
    { value: 'TRANSFER', label: '🏦 เงินโอน', color: 'blue' },
    { value: 'CREDIT', label: '📋 ค้างชำระ', color: 'amber' },
];

function PaymentModal({ total, loading, onConfirm, onClose, defaultPrintType, allowCredit = true }: {
    total: number; loading: boolean;
    onConfirm: (payments: { method: string; amount: number; dueDate?: string }[], printType: 'bill' | 'invoice' | 'none', cashReceived?: number) => void;
    onClose: () => void;
    defaultPrintType?: 'bill' | 'invoice' | 'none';
    allowCredit?: boolean;
}) {
    const [lines, setLines] = useState<PaymentLine[]>([
        { method: 'CASH', amount: total, dueDate: '' }
    ]);
    const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>([]);
    const [printType, setPrintType] = useState<'bill' | 'invoice' | 'none'>(defaultPrintType || 'bill');
    const [cashReceived, setCashReceived] = useState<number | ''>(0);

    // Sync printType when defaultPrintType prop updates
    useEffect(() => {
        if (defaultPrintType) setPrintType(defaultPrintType);
    }, [defaultPrintType]);

    // Fetch bank accounts on mount
    useEffect(() => {
        fetch('/api/bank-accounts').then(r => r.json()).then((data: BankAccountInfo[]) => {
            const active = data.filter(a => a.isActive);
            setBankAccounts(active);
        }).catch(console.error);
    }, []);

    const paid = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const remaining = total - paid;
    const hasCash = lines.some(l => l.method === 'CASH' && l.amount > 0);
    const cashTotal = lines.filter(l => l.method === 'CASH').reduce((s, l) => s + (l.amount || 0), 0);
    const cashReceivedValid = !hasCash || (typeof cashReceived === 'number' && cashReceived >= cashTotal);
    const isValid = Math.abs(remaining) < 0.01 && lines.every(l =>
        l.amount > 0 && (l.method !== 'CREDIT' || l.dueDate)
    ) && cashReceivedValid;

    const updateLine = (idx: number, patch: Partial<PaymentLine>) => {
        setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
    };
    const removeLine = (idx: number) => {
        const newLines = lines.filter((_, i) => i !== idx);
        setLines(newLines.length === 0 ? [{ method: 'CASH', amount: total, dueDate: '' }] : newLines);
    };
    const addLine = () => {
        const rem = Math.max(0, total - lines.reduce((s, l) => s + (l.amount || 0), 0));
        // Auto-select default bank for TRANSFER lines
        const defaultBank = bankAccounts.find(a => a.isDefault);
        setLines([...lines, { method: 'CASH', amount: Math.round(rem * 100) / 100, dueDate: '', bankAccountId: defaultBank?.id }]);
    };
    const setFullAmount = (idx: number) => {
        const otherSum = lines.reduce((s, l, i) => i === idx ? s : s + (l.amount || 0), 0);
        updateLine(idx, { amount: Math.round((total - otherSum) * 100) / 100 });
    };

    // When switching to TRANSFER, auto-select default bank
    const handleMethodChange = (idx: number, method: string) => {
        const defaultBank = bankAccounts.find(a => a.isDefault);
        updateLine(idx, {
            method,
            dueDate: method !== 'CREDIT' ? '' : lines[idx].dueDate,
            bankAccountId: method === 'TRANSFER' ? (lines[idx].bankAccountId || defaultBank?.id) : undefined,
        });
    };

    const handleConfirm = () => {
        const payments = lines.map(l => ({
            method: l.method,
            amount: l.amount,
            ...(l.method === 'CREDIT' && l.dueDate ? { dueDate: l.dueDate } : {}),
        }));
        const cashVal = typeof cashReceived === 'number' && cashReceived > 0 ? cashReceived : undefined;
        onConfirm(payments, printType, cashVal);
    };

    // Calculate change — show whenever there's a cash component
    const isCashOnly = lines.length === 1 && lines[0].method === 'CASH';
    const changeAmount = hasCash && typeof cashReceived === 'number' ? cashReceived - cashTotal : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">💳 ชำระเงิน</h3>
                        <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                    </div>
                    <p className="text-3xl font-black mt-1">{formatCurrency(total)}</p>
                </div>

                {/* Payment Lines */}
                <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                    {lines.map((line, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50/50">
                            {/* Method selector */}
                            <div className="flex gap-1">
                                {PAYMENT_METHODS.map(m => {
                                    const isDisabled = m.value === 'CREDIT' && !allowCredit;
                                    return (
                                    <button key={m.value} type="button"
                                        onClick={() => !isDisabled && handleMethodChange(idx, m.value)}
                                        disabled={isDisabled}
                                        title={isDisabled ? 'ต้องเลือกลูกค้าก่อนจึงจะใช้ค้างชำระได้' : ''}
                                        className={`flex-1 rounded-lg text-xs font-medium py-1.5 transition-all ${isDisabled
                                            ? 'bg-gray-100 text-gray-300 border border-gray-100 cursor-not-allowed'
                                            : line.method === m.value
                                                ? 'bg-emerald-500 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                                            }`}>
                                        {m.label}
                                    </button>
                                    );
                                })}
                            </div>

                            {/* Bank account selector for TRANSFER */}
                            {line.method === 'TRANSFER' && bankAccounts.length > 0 && (
                                <div>
                                    <select value={line.bankAccountId || ''}
                                        onChange={e => updateLine(idx, { bankAccountId: e.target.value })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                                        <option value="">เลือกบัญชี...</option>
                                        {bankAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.bankName} - {acc.accountNumber} ({acc.accountName}){acc.isDefault ? ' ⭐' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Amount */}
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 shrink-0">฿</label>
                                <input
                                    type="number"
                                    value={line.amount || ''}
                                    onChange={e => updateLine(idx, { amount: parseFloat(e.target.value) || 0 })}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                                    step="0.01" min={0}
                                    placeholder="0.00"
                                />
                                <button type="button" onClick={() => setFullAmount(idx)}
                                    className="px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-medium hover:bg-emerald-100 shrink-0 border border-emerald-200">
                                    เต็มจำนวน
                                </button>
                                {lines.length > 1 && (
                                    <button type="button" onClick={() => removeLine(idx)}
                                        className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>
                                )}
                            </div>

                            {/* Credit due date */}
                            {line.method === 'CREDIT' && (
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500 shrink-0">📅 ครบกำหนด:</label>
                                    <input type="date" value={line.dueDate}
                                        onChange={e => updateLine(idx, { dueDate: e.target.value })}
                                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add payment line button */}
                    <button type="button" onClick={addLine}
                        className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs font-medium hover:border-emerald-400 hover:text-emerald-500 transition-colors">
                        + เพิ่มช่องทางชำระ (แยกจ่าย)
                    </button>

                    {/* Print type selector */}
                    <div className="rounded-xl border border-gray-200 p-3 bg-gray-50/50">
                        <p className="text-xs text-gray-500 mb-2">🖨️ เลือกรูปแบบการพิมพ์</p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPrintType('bill')}
                                className={`flex-1 rounded-lg text-xs font-medium py-2 transition-all ${printType === 'bill' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
                                🧾 ปริ้นบิล
                            </button>
                            <button type="button" onClick={() => setPrintType('invoice')}
                                className={`flex-1 rounded-lg text-xs font-medium py-2 transition-all ${printType === 'invoice' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
                                📄 ใบกำกับ
                            </button>
                            <button type="button" onClick={() => setPrintType('none')}
                                className={`flex-1 rounded-lg text-xs font-medium py-2 transition-all ${printType === 'none' ? 'bg-gray-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                                🚫 ไม่ปริ้น
                            </button>
                        </div>
                    </div>

                    {/* Cash received / change — show whenever there's a CASH payment */}
                    {hasCash && (
                        <div className={`rounded-xl border p-3 ${cashReceivedValid ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'}`}>
                            <p className="text-xs text-gray-500 mb-2">💵 รับเงินสดมา <span className="text-red-500">*จำเป็น</span></p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400">รับมา</label>
                                    <input
                                        type="number"
                                        value={cashReceived === 0 ? '' : cashReceived}
                                        onChange={e => setCashReceived(e.target.value ? parseFloat(e.target.value) : '')}
                                        onFocus={e => e.target.select()}
                                        onKeyDown={e => { if (e.key === 'Enter' && isValid && !loading) handleConfirm(); }}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-right ${!cashReceivedValid ? 'border-red-300' : 'border-emerald-200'}`}
                                        placeholder={formatCurrency(cashTotal)}
                                        min={0}
                                        step="0.01"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400">เงินทอน</label>
                                    <div className={`px-3 py-2 rounded-lg text-sm font-bold text-right ${changeAmount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                        {changeAmount >= 0 ? formatCurrency(changeAmount) : `-${formatCurrency(Math.abs(changeAmount))}`}
                                    </div>
                                </div>
                            </div>
                            {!cashReceivedValid && (
                                <p className="text-xs text-red-500 mt-2">⚠️ กรุณาคีย์จำนวนเงินสดที่รับมา (ต้อง ≥ {formatCurrency(cashTotal)})</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer: Remaining + Confirm */}
                <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                    {/* Balance indicator */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">ยอดชำระแล้ว</span>
                        <span className={`font-bold ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatCurrency(paid)} / {formatCurrency(total)}
                        </span>
                    </div>
                    {remaining > 0.01 && (
                        <div className="text-xs text-red-500 text-right">ยังเหลืออีก {formatCurrency(remaining)}</div>
                    )}
                    {remaining < -0.01 && (
                        <div className="text-xs text-red-500 text-right">ชำระเกิน {formatCurrency(Math.abs(remaining))}</div>
                    )}

                    <button
                        onClick={handleConfirm}
                        disabled={!isValid || loading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? 'กำลังดำเนินการ...' : '✅ ยืนยันชำระเงิน'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function POSPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [bundles, setBundles] = useState<BundleInfo[]>([]);
    const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            const saved = sessionStorage.getItem('pos_customer');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [cart, setCart] = useState<CartItem[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const saved = sessionStorage.getItem('pos_cart');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [userId, setUserId] = useState('');
    const [userPrintSetting, setUserPrintSetting] = useState('bill');
    const [search, setSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);


    // Track which items just had quantity changes (for pulse animation)
    const [pulsingItems, setPulsingItems] = useState<Set<string>>(new Set());
    // Track last added item index for slide-in animation
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const cartEndRef = useRef<HTMLDivElement>(null);
    const desktopSearchRef = useRef<HTMLDivElement>(null);
    const mobileSearchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchInputMobileRef = useRef<HTMLInputElement>(null);
    const qtyInputRef = useRef<HTMLInputElement>(null);

    // Default quantity preset — value used when adding items to cart
    const [defaultQty, setDefaultQty] = useState(1);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Bill-level discount
    const [billDiscount, setBillDiscount] = useState(0);
    const [showBillDiscount, setShowBillDiscount] = useState(false);

    // Cart persistence keys
    const CART_STORAGE_KEY = 'pos_cart';
    const CUSTOMER_STORAGE_KEY = 'pos_customer';

    useEffect(() => {
        let userDefaultWhId = '';
        let currentUserId = '';
        try {
            const token = document.cookie.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
            if (token) {
                const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1]), c => c.charCodeAt(0))));
                if (payload.userId) { setUserId(payload.userId); currentUserId = payload.userId; }
                if (payload.defaultWarehouseId) userDefaultWhId = payload.defaultWarehouseId;
            }
        } catch { /* ignore */ }

        // Fetch latest printSetting from API (not JWT, so changes take effect without re-login)
        if (currentUserId) {
            fetch(`/api/users/${currentUserId}`).then(r => r.json()).then(data => {
                if (data.printSetting) setUserPrintSetting(data.printSetting);
            }).catch(() => { });
        }

        Promise.all([
            fetch('/api/warehouses').then(r => r.json()),
            fetch('/api/customer-groups').then(r => r.json()),
            fetch('/api/bundles').then(r => r.json()).catch(() => []),
        ]).then(([w, cg, b]) => {
            setWarehouses(w);
            setCustomerGroups(cg);
            setBundles(b);
            // Use user's default warehouse if set, otherwise first warehouse
            const whId = userDefaultWhId && w.some((wh: any) => wh.id === userDefaultWhId) ? userDefaultWhId : w[0]?.id || '';
            if (whId) setDefaultWarehouseId(whId);
        });
    }, []);

    // Server-side product search with debounce
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (search.length < 2) {
            setProducts([]);
            return;
        }

        setSearchLoading(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/products?search=${encodeURIComponent(search)}&warehouseId=${defaultWarehouseId}`);
                const data = await res.json();
                setProducts(data);
                setShowSearchResults(true);
            } catch { /* ignore */ }
            setSearchLoading(false);
        }, 300);

        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [search, defaultWarehouseId]);

    useEffect(() => {
        if (customerSearch) {
            fetch(`/api/customers?search=${customerSearch}`).then(r => r.json()).then(setCustomers);
        }
    }, [customerSearch]);

    // Persist cart to sessionStorage
    useEffect(() => {
        try { sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
    }, [cart]);
    useEffect(() => {
        try {
            if (selectedCustomer) sessionStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(selectedCustomer));
            else sessionStorage.removeItem(CUSTOMER_STORAGE_KEY);
        } catch { /* ignore */ }
    }, [selectedCustomer]);



    const getPrice = (product: Product): number => {
        if (selectedCustomer) {
            const groupPrice = product.productPrices.find(
                p => p.customerGroup.id === selectedCustomer.customerGroup.id
            );
            if (groupPrice) return Number(groupPrice.price);
        }
        // ลูกค้าทั่วไป → ใช้ราคาขายปกติ (product.price)
        return Number(product.price);
    };

    const getStock = (product: Product, warehouseId: string): number => {
        const stock = product.productStocks.find(s => s.warehouseId === warehouseId);
        return stock?.quantity || 0;
    };

    // Trigger pulse animation on an item
    const triggerPulse = (productId: string) => {
        setPulsingItems(prev => new Set(prev).add(productId));
        setTimeout(() => {
            setPulsingItems(prev => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
        }, 600);
    };

    // Auto-reprice cart items when customer changes
    useEffect(() => {
        if (cart.length === 0) return;
        setCart(prev => prev.map(c => {
            if (c.isBundle) return c;
            const product = products.find(p => p.id === c.productId);
            if (!product) return c;

            if (selectedCustomer) {
                // Find price for this customer group + current unit
                const unitId = c.selectedUnitId || null;
                const gp = c.productPrices.find(pp =>
                    pp.customerGroupId === selectedCustomer.customerGroup.id && pp.productUnitId === unitId
                );
                if (gp) return { ...c, unitPrice: gp.price };
            }
            // No customer or no group price → revert to normal price
            if (c.selectedUnitId) {
                const unit = product.productUnits?.find(u => u.id === c.selectedUnitId);
                if (unit) return { ...c, unitPrice: Number(unit.sellingPrice) };
            }
            return { ...c, unitPrice: getPrice(product) };
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomer]);

    const addToCart = (product: Product) => {
        const warehouseId = defaultWarehouseId;
        const stock = getStock(product, warehouseId);

        // Always default to the base product unit initially, instead of a secondary unit
        const selectedUnit: { id: string; sellingPrice: number | string } | null = null;
        const convRate = 1;
        const unitName = product.unit;

        const qtyToAdd = defaultQty || 1;
        const existing = cart.find(c => c.productId === product.id && c.warehouseId === warehouseId && c.selectedUnitId === '');
        if (existing) {
            setCart(cart.map(c =>
                c.productId === product.id && c.warehouseId === warehouseId && c.selectedUnitId === ''
                    ? { ...c, quantity: c.quantity + qtyToAdd, points: (c.quantity + qtyToAdd) * c.conversionRate * c.pointsPerUnit }
                    : c
            ));
            triggerPulse(product.id);
            setDefaultQty(1);
        } else {
            // Auto-determine price based on customer group + unit
            let price = getPrice(product);
            const priceTier = 'custom';
            if (selectedCustomer) {
                const unitId = null;
                const gp = product.productPrices.find(p =>
                    p.customerGroup.id === selectedCustomer.customerGroup.id && p.productUnitId === unitId
                );
                if (gp) price = Number(gp.price);
            }
            setCart([...cart, {
                productId: product.id, productName: product.name, productCode: product.code,
                unit: unitName, warehouseId, quantity: qtyToAdd, unitPrice: price,
                points: product.pointsPerUnit * qtyToAdd, availableStock: stock,
                pointsPerUnit: product.pointsPerUnit,
                priceTier,
                productPrices: product.productPrices.map(pp => ({ customerGroupId: pp.customerGroup.id, productUnitId: pp.productUnitId, price: Number(pp.price) })),
                selectedUnitId: '',
                selectedUnitName: unitName,
                conversionRate: convRate,
                baseUnitPrice: price,
                productUnits: product.productUnits || [],
                itemDiscount: 0,
            }]);
            setLastAddedId(product.id);
            setTimeout(() => setLastAddedId(null), 400);
            setTimeout(() => cartEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            setDefaultQty(1);
        }
    };

    const addBundleToCart = (bundle: BundleInfo) => {
        const warehouseId = defaultWarehouseId;
        const bundlePrice = Number(bundle.bundlePrice);
        const totalItemPrice = bundle.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

        // Build sub-items for stock deduction
        const subItems: BundleSubItem[] = bundle.items.map(bundleItem => {
            const product = products.find(p => p.id === bundleItem.productId);
            const proportion = totalItemPrice > 0
                ? (Number(bundleItem.product.price) * bundleItem.quantity / totalItemPrice)
                : (1 / bundle.items.length);
            const itemPrice = Math.round((bundlePrice * proportion / bundleItem.quantity) * 100) / 100;
            return {
                productId: bundleItem.productId,
                productName: bundleItem.product.name,
                productCode: bundleItem.product.code,
                unit: bundleItem.product.unit,
                warehouseId,
                quantity: bundleItem.quantity,
                unitPrice: itemPrice,
                points: (product?.pointsPerUnit || 0) * bundleItem.quantity,
            };
        });

        // Rounding adjustment: ensure sub-item totals sum to exactly bundlePrice
        const subTotal = subItems.reduce((s, si) => s + si.quantity * si.unitPrice, 0);
        const roundingDiff = Math.round((bundlePrice - subTotal) * 100) / 100;
        if (roundingDiff !== 0 && subItems.length > 0) {
            const lastItem = subItems[subItems.length - 1];
            lastItem.unitPrice = Math.round((lastItem.unitPrice + roundingDiff / lastItem.quantity) * 100) / 100;
        }

        // Check if same bundle already in cart → increment qty
        const existing = cart.find(c => c.isBundle && c.bundleId === bundle.id);
        if (existing) {
            setCart(prev => prev.map(c =>
                c.isBundle && c.bundleId === bundle.id
                    ? {
                        ...c,
                        quantity: c.quantity + 1,
                        // bundleItems keep per-1-bundle quantities; confirmPayment multiplies by c.quantity
                    }
                    : c
            ));
            triggerPulse(bundle.id);
        } else {
            // Add as 1 single line
            setCart(prev => [...prev, {
                productId: bundle.id,
                productName: bundle.name,
                productCode: bundle.code,
                unit: 'ชุด',
                warehouseId,
                quantity: 1,
                unitPrice: bundlePrice,
                points: subItems.reduce((s, si) => s + si.points, 0),
                availableStock: 9999,
                pointsPerUnit: subItems.reduce((s, si) => s + si.points, 0),
                priceTier: 'custom',
                productPrices: [],
                selectedUnitId: '',
                selectedUnitName: 'ชุด',
                conversionRate: 1,
                baseUnitPrice: bundlePrice,
                productUnits: [],
                isBundle: true,
                bundleId: bundle.id,
                bundleName: bundle.name,
                bundleItems: subItems,
                itemDiscount: 0,
            }]);
        }
        setLastAddedId(bundle.id);
        setTimeout(() => setLastAddedId(null), 400);
        setTimeout(() => cartEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        setDefaultQty(1);
    };

    const updateCartQty = (idx: number, qty: number) => {
        if (qty <= 0) { removeFromCart(idx); return; }
        const item = cart[idx];
        setCart(cart.map((c, i) => i === idx ? { ...c, quantity: qty, points: qty * c.conversionRate * c.pointsPerUnit } : c));
        triggerPulse(item.productId);
    };

    const updateCartWarehouse = async (idx: number, warehouseId: string) => {
        // Update warehouse immediately, then fetch real stock from API
        setCart(prev => prev.map((c, i) => {
            if (i !== idx) return c;
            const updated = { ...c, warehouseId };
            if (updated.isBundle && updated.bundleItems) {
                updated.bundleItems = updated.bundleItems.map(bi => ({ ...bi, warehouseId }));
            }
            return updated;
        }));
        
        const item = cart[idx];
        if (item.isBundle) {
            setCart(prev => prev.map((c, i) => i === idx ? { ...c, availableStock: 9999 } : c));
            return;
        }

        try {
            const res = await fetch(`/api/products?search=${encodeURIComponent(item.productCode)}&warehouseId=${warehouseId}`);
            const data = await res.json();
            const product = Array.isArray(data) ? data.find((p: any) => p.id === item.productId) : null;
            const stock = product?.productStocks?.[0]?.quantity ?? 0;
            setCart(prev => prev.map((c, i) => i === idx && c.warehouseId === warehouseId ? { ...c, availableStock: stock } : c));
        } catch {
            // Fallback: try from products state
            const product = products.find(p => p.id === item.productId);
            const stock = product ? getStock(product, warehouseId) : 0;
            setCart(prev => prev.map((c, i) => i === idx ? { ...c, availableStock: stock } : c));
        }
    };

    const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

    const updateCartPrice = (idx: number, price: number) => {
        setCart(cart.map((c, i) => i === idx ? { ...c, unitPrice: price, priceTier: 'custom' } : c));
    };

    // updateCartPriceTier removed — price is auto-determined by customer group + unit

    const updateCartUnit = (idx: number, unitId: string) => {
        setCart(cart.map((c, i) => {
            if (i !== idx) return c;
            const product = products.find(p => p.id === c.productId);
            const baseStock = product ? getStock(product, c.warehouseId) : c.availableStock;

            // "default" = product's original unit (no productUnit record)
            if (unitId === '__default__') {
                // Determine the base unit price:
                // 1. Try customer group price for base unit (productUnitId === null)
                // 2. Try product.price from products array
                // 3. Fallback: find base unit in productUnits and use its sellingPrice
                let price: number | undefined;
                if (selectedCustomer) {
                    const gp = c.productPrices.find(pp =>
                        pp.customerGroupId === selectedCustomer.customerGroup.id && pp.productUnitId === null
                    );
                    if (gp) price = gp.price;
                }
                if (price === undefined) {
                    if (product) {
                        price = getPrice(product);
                    } else {
                        // products array cleared after search — use stored baseUnitPrice
                        price = c.baseUnitPrice;
                    }
                }
                return {
                    ...c,
                    selectedUnitId: '',
                    selectedUnitName: c.unit,
                    conversionRate: 1,
                    unitPrice: price,
                    availableStock: baseStock,
                    priceTier: 'custom',
                    points: c.quantity * 1 * c.pointsPerUnit,
                };
            }

            const unit = c.productUnits.find(u => u.id === unitId);
            if (!unit) return c;
            const convRate = Number(unit.conversionRate);
            // Auto-lookup group price for this specific unit
            let unitPrice = Number(unit.sellingPrice);
            if (selectedCustomer) {
                const gp = c.productPrices.find(pp =>
                    pp.customerGroupId === selectedCustomer.customerGroup.id && pp.productUnitId === unit.id
                );
                if (gp) unitPrice = gp.price;
            }
            return {
                ...c,
                selectedUnitId: unit.id,
                selectedUnitName: unit.unitName,
                conversionRate: convRate,
                unitPrice,
                availableStock: baseStock,
                priceTier: 'custom',
                points: c.quantity * convRate * c.pointsPerUnit,
            };
        }));
    };

    const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const itemDiscountsTotal = cart.reduce((s, i) => s + (i.itemDiscount || 0), 0);
    const total = subtotal - itemDiscountsTotal - billDiscount;
    const totalPoints = cart.reduce((s, i) => s + i.points, 0);
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    const [saleNotes, setSaleNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showHeldSales, setShowHeldSales] = useState(false);

    // ── Held Sales (localStorage) ──
    const HELD_SALES_KEY = 'pos_held_sales';
    const [heldSales, setHeldSales] = useState<HeldSale[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem(HELD_SALES_KEY) || '[]'); } catch { return []; }
    });
    useEffect(() => {
        try { localStorage.setItem(HELD_SALES_KEY, JSON.stringify(heldSales)); } catch { /* ignore */ }
    }, [heldSales]);

    const holdSale = () => {
        if (cart.length === 0) return;
        if (heldSales.length >= 10) {
            setAlertModal({ open: true, message: 'รายการพักเต็มแล้ว (สูงสุด 10 รายการ) กรุณาลบรายการเก่าก่อน', type: 'warning', title: 'ไม่สามารถพักได้' });
            return;
        }
        const held: HeldSale = {
            id: Date.now().toString(),
            cart: [...cart],
            customer: selectedCustomer,
            billDiscount,
            notes: saleNotes,
            heldAt: new Date().toISOString(),
            label: selectedCustomer?.name || 'ลูกค้าทั่วไป',
        };
        setHeldSales(prev => [...prev, held]);
        setCart([]);
        setSelectedCustomer(null);
        setBillDiscount(0);
        setSaleNotes('');
        setShowNotes(false);
        setShowBillDiscount(false);
        setAlertModal({ open: true, message: `พักรายการ "${held.label}" เรียบร้อย`, type: 'success', title: '⏸ พักการขาย' });
    };

    const resumeSale = (index: number) => {
        const held = heldSales[index];
        if (!held) return;
        // If current cart has items, swap — hold current cart first
        if (cart.length > 0) {
            const currentHeld: HeldSale = {
                id: Date.now().toString(),
                cart: [...cart],
                customer: selectedCustomer,
                billDiscount,
                notes: saleNotes,
                heldAt: new Date().toISOString(),
                label: selectedCustomer?.name || 'ลูกค้าทั่วไป',
            };
            setHeldSales(prev => [...prev.filter((_, i) => i !== index), currentHeld]);
        } else {
            setHeldSales(prev => prev.filter((_, i) => i !== index));
        }
        // Restore held sale
        setCart(held.cart);
        setSelectedCustomer(held.customer);
        setBillDiscount(held.billDiscount);
        setSaleNotes(held.notes);
        setShowNotes(!!held.notes);
        setShowHeldSales(false);
        setAlertModal({ open: true, message: `เปิดรายการ "${held.label}" กลับมาขายต่อ`, type: 'success', title: '▶️ กลับมาขายต่อ' });
    };

    const deleteHeldSale = (index: number) => {
        setHeldSales(prev => prev.filter((_, i) => i !== index));
    };

    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info'; title?: string }>({ open: false, message: '', type: 'info' });

    const openPaymentModal = () => {
        if (cart.length === 0) { setAlertModal({ open: true, message: 'กรุณาเลือกสินค้า', type: 'warning', title: 'ข้อมูลไม่ครบ' }); return; }
        if (!userId) {
            setAlertModal({ open: true, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', type: 'error', title: 'เกิดข้อผิดพลาด' });
            setTimeout(() => router.push('/login'), 1500);
            return;
        }
        setShowPaymentModal(true);
    };

    const confirmPayment = async (payments: { method: string; amount: number; dueDate?: string }[], printType: 'bill' | 'invoice' | 'none', cashReceived?: number) => {
        setLoading(true);
        try {
            // Expand bundle items into individual product items for stock deduction
            const saleItems: { productId: string; warehouseId: string; quantity: number; unitPrice: number; points: number; conversionRate: number; unitName?: string; itemDiscount?: number }[] = [];
            for (const c of cart) {
                if (c.isBundle && c.bundleItems) {
                    const bundleTotal = Math.round(c.unitPrice * c.quantity * 100) / 100;
                    let currentSum = 0;
                    const bItems: { productId: string; warehouseId: string; quantity: number; unitPrice: number; points: number; conversionRate: number; unitName?: string; itemDiscount?: number }[] = [];
                    for (const si of c.bundleItems) {
                        const itemQty = si.quantity * c.quantity;
                        const lineTotal = Math.round(si.unitPrice * itemQty * 100) / 100;
                        currentSum += lineTotal;
                        bItems.push({
                            productId: si.productId, warehouseId: si.warehouseId,
                            quantity: itemQty, unitPrice: si.unitPrice, points: si.points * c.quantity,
                            conversionRate: 1,
                            unitName: si.unit,
                        });
                    }
                    const diff = Math.round((currentSum - bundleTotal) * 100) / 100;
                    if (diff !== 0 && bItems.length > 0) {
                        bItems[bItems.length - 1].itemDiscount = diff;
                    }
                    saleItems.push(...bItems);
                } else {
                    saleItems.push({
                        productId: c.productId, warehouseId: c.warehouseId,
                        quantity: c.quantity, unitPrice: c.unitPrice, points: c.points,
                        conversionRate: c.conversionRate,
                        unitName: c.selectedUnitName,
                        itemDiscount: c.itemDiscount || 0,
                    });
                }
            }
            const result = await createSaleFromPOS({
                customerId: selectedCustomer?.id,
                items: saleItems,
                userId,
                payments,
                notes: saleNotes.trim() || undefined,
                discount: billDiscount,
                cashReceived: cashReceived && typeof cashReceived === 'number' ? cashReceived : undefined,
            });
            setShowPaymentModal(false);
            setCart([]);
            setSelectedCustomer(null);
            setBillDiscount(0);
            setShowBillDiscount(false);
            setSaleNotes('');
            setShowNotes(false);

            // Auto-print based on selected print type
            if (result?.id && printType !== 'none') {
                if (printType === 'bill') {
                    const url = cashReceived ? `/receipt/${result.id}?cashReceived=${cashReceived}` : `/receipt/${result.id}`;
                    window.open(url, '_blank');
                } else {
                    window.open(`/invoice/${result.id}`, '_blank');
                }
            }

            // Show success and reload products for updated stock
            setAlertModal({ open: true, message: `สร้างบิลขาย ${result?.saleNumber || ''} เรียบร้อย ตัด stock แล้ว`, type: 'success', title: 'ชำระเงินสำเร็จ!' });
            if (defaultWarehouseId) { setProducts([]); setSearch(''); }
        } catch (error) {
            const msg = (error as Error).message;
            if (msg.includes('เข้าสู่ระบบ')) {
                setAlertModal({ open: true, message: msg, type: 'error', title: 'เซสชันหมดอายุ' });
                setTimeout(() => router.push('/login'), 1500);
            } else {
                setAlertModal({ open: true, message: msg, type: 'error', title: 'เกิดข้อผิดพลาด' });
            }
        } finally { setLoading(false); }
    };

    const filteredBundles = bundles.filter(b =>
        !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.code.toLowerCase().includes(search.toLowerCase())
    );

    const [showSearchResults, setShowSearchResults] = useState(false);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const insideDesktop = desktopSearchRef.current?.contains(e.target as Node);
            const insideMobile = mobileSearchRef.current?.contains(e.target as Node);
            if (!insideDesktop && !insideMobile) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const searchResults = search.length >= 2
        ? [...products.map(p => ({ type: 'product' as const, data: p })),
        ...filteredBundles.map(b => ({ type: 'bundle' as const, data: b }))]
        : [];

    // Keyboard handler for search: Arrow keys + Enter
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (!showSearchResults || searchResults.length === 0) {
            // Global shortcuts when not in dropdown
            if (e.key === '+' && cart.length > 0) { e.preventDefault(); openPaymentModal(); return; }
            if (e.key === '-') { e.preventDefault(); setShowBillDiscount(true); return; }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (highlightedIndex + 1) % searchResults.length;
            setHighlightedIndex(next);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = highlightedIndex <= 0 ? searchResults.length - 1 : highlightedIndex - 1;
            setHighlightedIndex(next);
        } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
            e.preventDefault();
            const r = searchResults[highlightedIndex];
            if (r.type === 'product') { addToCart(r.data as Product); }
            else { addBundleToCart(r.data as BundleInfo); }
            setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1);
        }
    };

    // Auto-scroll highlighted item into view
    useEffect(() => {
        if (highlightedIndex < 0) return;
        const el = document.querySelector(`[data-search-index="${highlightedIndex}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            // Only handle shortcuts when not typing in inputs (except search)
            const isSearchInput = e.target === searchInputRef.current || e.target === searchInputMobileRef.current;
            if (!isSearchInput && isInput) return;
            if (e.key === '+' && !isInput && cart.length > 0) { e.preventDefault(); openPaymentModal(); }
            if (e.key === '-' && !isInput) { e.preventDefault(); setShowBillDiscount(true); }
            if (e.key === '*') { e.preventDefault(); qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart]);

    return (
        <div className="animate-fade-in -m-4 lg:-m-6">
            <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-screen bg-white">

                {/* ══════ Top Bar ══════ */}
                <div className="bg-white border-b border-gray-200 px-3 py-2 lg:p-4 lg:pt-6">
                    <div className="max-w-5xl mx-auto">
                        {/* Row 1: POS title + warehouse */}
                        <div className="flex items-center gap-2 mb-2 lg:mb-0">
                            <h1 className="text-base lg:text-lg font-bold text-gray-800 shrink-0">🛒 POS</h1>
                            <div className="flex items-center gap-1 shrink-0">
                                <label className="text-[10px] lg:text-xs text-gray-500">คลัง:</label>
                                <select
                                    value={defaultWarehouseId}
                                    onChange={e => setDefaultWarehouseId(e.target.value)}
                                    className="px-1.5 py-1 rounded-lg border border-gray-200 text-xs lg:text-sm outline-none font-medium"
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="flex-1" />
                            {/* Desktop: Customer + Search inline */}
                            <div className="hidden lg:flex items-center gap-3">
                                <div className="relative shrink-0">
                                    {selectedCustomer ? (
                                        <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-1.5">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{selectedCustomer.name}</p>
                                                <p className="text-[10px] text-gray-500">{selectedCustomer.customerGroup.name} · {selectedCustomer.phone}</p>
                                            </div>
                                            <button onClick={() => setShowCustomerPicker(!showCustomerPicker)} className="text-xs text-emerald-600 px-1">เปลี่ยน</button>
                                            <button onClick={() => setSelectedCustomer(null)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-emerald-400 hover:text-emerald-600">
                                            👤 เลือกลูกค้า
                                        </button>
                                    )}
                                    {showCustomerPicker && (
                                        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                                                placeholder="ค้นหาชื่อหรือเบอร์โทร..." className="w-full px-3 py-2.5 text-sm border-b border-gray-100 outline-none" autoFocus />
                                            <div className="max-h-48 overflow-y-auto">
                                                {customers.map(c => (
                                                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                                                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 text-sm transition-colors">
                                                        {c.name} · {c.phone} <span className="text-xs text-gray-400 ml-1">({c.customerGroup.name})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Quantity Preset Input */}
                                <div className="flex items-center gap-1.5 shrink-0" title="จำนวนเริ่มต้น (กด * เพื่อเลือก)">
                                    <label className="text-[10px] text-gray-500">จำนวน:</label>
                                    <input
                                        ref={qtyInputRef}
                                        type="number"
                                        value={defaultQty}
                                        onChange={e => setDefaultQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        onFocus={e => e.target.select()}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); searchInputRef.current?.focus(); }
                                            if (e.key === '*') { e.preventDefault(); }
                                        }}
                                        min={1}
                                        className={`w-14 px-2 py-1.5 rounded-lg border text-sm font-bold text-center outline-none transition-all ${
                                            defaultQty > 1
                                                ? 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-200'
                                                : 'border-gray-200 text-gray-700 focus:ring-2 focus:ring-emerald-500'
                                        }`}
                                    />
                                    {defaultQty > 1 && (
                                        <button onClick={() => setDefaultQty(1)} className="text-amber-400 hover:text-amber-600 text-xs" title="รีเซ็ตเป็น 1">✕</button>
                                    )}
                                </div>
                                <div ref={desktopSearchRef} className="relative w-[480px] shrink-0">
                                    <input ref={searchInputRef} type="text" value={search}
                                        onChange={e => { setSearch(e.target.value); setShowSearchResults(true); setHighlightedIndex(-1); }}
                                        onFocus={() => { if (search) setShowSearchResults(true); }}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="🔍 ค้นหาสินค้า..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-emerald-50/50"
                                    />
                                    {showSearchResults && searchResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[400px] overflow-y-auto"
                                            onMouseDown={e => e.preventDefault()}>
                                            {searchResults.map((result, i) => {
                                                if (result.type === 'product') {
                                                    const p = result.data as Product;
                                                    const stock = getStock(p, defaultWarehouseId);
                                                    const price = getPrice(p);
                                                    const inCart = cart.find(c => c.productId === p.id);
                                                    return (
                                                        <button key={p.id}
                                                            data-search-index={i}
                                                            onClick={() => { addToCart(p); setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1); }}
                                                            className={`w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-emerald-100' : inCart ? 'bg-emerald-50/50' : ''}`}>
                                                            {p.imageUrl ? (
                                                                <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-mono text-gray-400 shrink-0">📦</div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                                                <p className="text-xs text-gray-400">{p.code} · {p.unit}</p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-sm font-bold text-emerald-600">{formatCurrency(price)}</p>
                                                                <p className={`text-xs ${stock <= 0 ? 'text-red-500' : stock < 10 ? 'text-orange-500' : 'text-gray-400'}`}>คงเหลือ {stock}</p>
                                                            </div>
                                                            {inCart && <span className="bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">{inCart.quantity}</span>}
                                                        </button>
                                                    );
                                                } else {
                                                    const b = result.data as BundleInfo;
                                                    return (
                                                        <button key={b.id}
                                                            onClick={() => { addBundleToCart(b); setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1); }}
                                                            data-search-index={i}
                                                            className={`w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-purple-100' : ''}`}>
                                                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-sm shrink-0">🎁</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-purple-800 truncate">{b.name}</p>
                                                                <p className="text-xs text-purple-400">{b.code} · {b.items.length} สินค้า</p>
                                                            </div>
                                                            <p className="text-sm font-bold text-purple-600 shrink-0">{formatCurrency(Number(b.bundlePrice))}</p>
                                                        </button>
                                                    );
                                                }
                                            })}
                                        </div>
                                    )}
                                    {showSearchResults && search.length > 0 && searchResults.length === 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-6 text-center text-gray-400 text-sm">ไม่พบสินค้าที่ค้นหา</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Mobile: Customer + Search stacked */}
                        <div className="lg:hidden space-y-1.5">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    {selectedCustomer ? (
                                        <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2 py-1">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-medium text-gray-800 truncate block">{selectedCustomer.name}</span>
                                                <span className="text-[9px] text-gray-500">{selectedCustomer.customerGroup.name}</span>
                                            </div>
                                            <button onClick={() => setShowCustomerPicker(!showCustomerPicker)} className="text-[10px] text-emerald-600">เปลี่ยน</button>
                                            <button onClick={() => setSelectedCustomer(null)} className="text-red-400 text-xs">✕</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                                            👤 เลือกลูกค้า
                                        </button>
                                    )}
                                    {showCustomerPicker && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                                                placeholder="ค้นหาชื่อหรือเบอร์โทร..." className="w-full px-3 py-2 text-sm border-b border-gray-100 outline-none" autoFocus />
                                            <div className="max-h-48 overflow-y-auto">
                                                {customers.map(c => (
                                                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                                                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm transition-colors">
                                                        {c.name} · {c.phone} <span className="text-xs text-gray-400">({c.customerGroup.name})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div ref={mobileSearchRef} className="relative">
                                <input ref={searchInputMobileRef} type="text" value={search}
                                    onChange={e => { setSearch(e.target.value); setShowSearchResults(true); setHighlightedIndex(-1); }}
                                    onFocus={() => { if (search) setShowSearchResults(true); }}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="🔍 ค้นหาสินค้า..."
                                    className="w-full px-3 py-2 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-emerald-50/50"
                                />
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[60vh] overflow-y-auto"
                                        onMouseDown={e => e.preventDefault()}>
                                        {searchResults.map((result, i) => {
                                            if (result.type === 'product') {
                                                const p = result.data as Product;
                                                const stock = getStock(p, defaultWarehouseId);
                                                const price = getPrice(p);
                                                const inCart = cart.find(c => c.productId === p.id);
                                                return (
                                                    <button key={p.id}
                                                        onClick={() => { addToCart(p); setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1); }}
                                                        data-search-index={i}
                                                        className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-emerald-100' : inCart ? 'bg-emerald-50/50' : ''}`}>
                                                        {p.imageUrl ? (
                                                            <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-md object-cover shrink-0 border border-gray-200" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-mono text-gray-400 shrink-0">📦</div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                                            <p className="text-[10px] text-gray-400">{p.code} · {p.unit} · คงเหลือ {stock}</p>
                                                        </div>
                                                        <p className="text-sm font-bold text-emerald-600 shrink-0">{formatCurrency(price)}</p>
                                                        {inCart && <span className="bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">{inCart.quantity}</span>}
                                                    </button>
                                                );
                                            } else {
                                                const b = result.data as BundleInfo;
                                                return (
                                                    <button key={b.id}
                                                        onClick={() => { addBundleToCart(b); setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1); }}
                                                        data-search-index={i}
                                                        className={`w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-purple-100' : ''}`}>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-purple-800 truncate">🎁 {b.name}</p>
                                                            <p className="text-[10px] text-purple-400">{b.code} · {b.items.length} สินค้า</p>
                                                        </div>
                                                        <p className="text-sm font-bold text-purple-600 shrink-0">{formatCurrency(Number(b.bundlePrice))}</p>
                                                    </button>
                                                );
                                            }
                                        })}
                                    </div>
                                )}
                                {showSearchResults && search.length > 0 && searchResults.length === 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 text-center text-gray-400 text-sm">ไม่พบสินค้าที่ค้นหา</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ Cart Content — Full Width ══════ */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-3 lg:p-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <p className="text-5xl mb-4">🛒</p>
                                <p className="text-lg font-medium text-gray-500 mb-1">ยังไม่มีสินค้าในตะกร้า</p>
                                <p className="text-sm">ใช้ช่องค้นหาด้านบนเพื่อเพิ่มสินค้า</p>
                                {heldSales.length > 0 && (
                                    <button onClick={() => setShowHeldSales(true)}
                                        className="mt-4 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium hover:bg-amber-100 transition-colors">
                                        📋 มีรายการพัก {heldSales.length} รายการ
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5 lg:space-y-2">
                                {cart.map((item, idx) => (
                                    <div
                                        key={item.productId + (item.bundleId || '')}
                                        className={`rounded-lg lg:rounded-xl transition-all ${pulsingItems.has(item.productId) ? 'animate-cart-pulse' : ''
                                            } ${lastAddedId === item.productId ? 'animate-cart-slide-in' : ''
                                            } ${item.isBundle
                                                ? 'bg-purple-50 border border-purple-200 p-2.5 lg:p-4 shadow-sm'
                                                : 'bg-white border border-gray-100 p-2.5 lg:p-4 shadow-sm'
                                            }`}
                                    >
                                        {item.isBundle ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs lg:text-sm font-semibold text-purple-800 truncate">🎁 {item.productName}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[10px] lg:text-xs text-purple-400">{item.productCode} · {formatCurrency(item.unitPrice)}/ชุด</p>
                                                            <select value={item.warehouseId} onChange={e => updateCartWarehouse(idx, e.target.value)}
                                                                className="px-1.5 py-0.5 rounded border border-purple-200 text-[10px] bg-purple-50 text-purple-700 outline-none">
                                                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center shrink-0">
                                                        <input type="number" value={item.quantity}
                                                            onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
                                                            onChange={e => { const raw = e.target.value.replace(/^0+(?=\d)/, ''); const val = parseInt(raw); if (!isNaN(val) && val >= 1) updateCartQty(idx, val); }}
                                                            onBlur={e => { const val = parseInt(e.target.value) || 1; updateCartQty(idx, Math.max(1, val)); }}
                                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                            className="font-bold text-xs lg:text-sm text-center w-10 lg:w-12 rounded border border-purple-200 bg-purple-50 py-0.5 outline-none focus:ring-1 focus:ring-purple-400 text-purple-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            min={1}
                                                        />
                                                    </div>
                                                    <p className="text-xs lg:text-sm font-bold text-purple-600 shrink-0">{formatCurrency(item.quantity * item.unitPrice)}</p>
                                                    <button onClick={() => removeFromCart(idx)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                                </div>
                                                {item.bundleItems && (
                                                    <div className="mt-1 pl-2 border-l-2 border-purple-200 space-y-0">
                                                        {item.bundleItems.map(si => (
                                                            <p key={si.productId} className="text-[10px] text-purple-400 leading-tight">{si.productName} ×{si.quantity * item.quantity}</p>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* Single row on desktop, 2 rows on mobile */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs lg:text-sm font-semibold text-gray-800 truncate">{item.productName}</p>
                                                        <p className="text-[10px] lg:hidden text-gray-400">{item.productCode} · {formatCurrency(item.unitPrice)}/{item.selectedUnitName}</p>
                                                        <p className="text-xs text-gray-400 hidden lg:block">{item.productCode}</p>
                                                    </div>
                                                    {/* Desktop inline controls */}
                                                    <div className="hidden lg:flex items-center gap-2 shrink-0 text-[11px]">
                                                        <select value={item.warehouseId} onChange={e => updateCartWarehouse(idx, e.target.value)}
                                                            className="px-1.5 py-0.5 rounded border border-gray-200 text-[11px] outline-none">
                                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                        </select>
                                                        <span className="text-gray-400 text-[10px]">({item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock})</span>
                                                        {item.productUnits && item.productUnits.length > 0 && (
                                                            <select value={item.selectedUnitId || '__default__'} onChange={e => updateCartUnit(idx, e.target.value)}
                                                                className="px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-[11px] outline-none font-medium">
                                                                <option value="__default__">
                                                                    {products.find(p => p.id === item.productId)?.unit || item.unit} (ปกติ)
                                                                </option>
                                                                {item.productUnits.map(u => (
                                                                    <option key={u.id} value={u.id}>
                                                                        {u.unitName} (×{Number(u.conversionRate)})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        <div className="flex items-center gap-0.5">
                                                            <span className="text-gray-400">฿</span>
                                                            <input type="number" value={item.unitPrice}
                                                                onChange={e => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                                                                className="w-20 px-1 py-0.5 rounded border border-gray-200 text-[11px] outline-none text-right font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                step="0.01" min={0}
                                                            />
                                                            <span className="text-gray-400">/{item.selectedUnitName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center shrink-0">
                                                        <input type="number" value={item.quantity}
                                                            onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
                                                            onChange={e => { const raw = e.target.value.replace(/^0+(?=\d)/, ''); const val = parseInt(raw); if (!isNaN(val) && val >= 1) updateCartQty(idx, val); }}
                                                            onBlur={e => { const val = parseInt(e.target.value) || 1; updateCartQty(idx, Math.max(1, val)); }}
                                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                            className="font-bold text-xs lg:text-sm text-center w-10 lg:w-12 rounded border border-gray-200 py-0.5 outline-none focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            min={1}
                                                        />
                                                    </div>
                                                    <p className="text-xs lg:text-sm font-bold text-emerald-600 shrink-0 min-w-[60px] lg:min-w-[80px] text-right">{formatCurrency(item.quantity * item.unitPrice)}</p>
                                                    <button onClick={() => removeFromCart(idx)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                                </div>
                                                {/* Item discount row + stock */}
                                                <div className="hidden lg:flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-400">ส่วนลด:</span>
                                                    <input type="number" value={item.itemDiscount || ''}
                                                        onChange={e => setCart(prev => prev.map((c, ci) => ci === idx ? { ...c, itemDiscount: parseFloat(e.target.value) || 0 } : c))}
                                                        className="w-20 px-1.5 py-0.5 rounded border border-gray-200 text-xs outline-none text-right"
                                                        placeholder="0" step="0.01" min={0} />
                                                    <span className="text-[10px] text-gray-400">บาท</span>
                                                    <span className="text-[10px] text-gray-400 ml-2">|</span>
                                                    <span className={`text-[10px] font-medium ${(item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock) <= 0 ? 'text-red-500' : (item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock) < 10 ? 'text-orange-500' : 'text-gray-500'}`}>📦 คงเหลือ {item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock} {item.selectedUnitName}</span>
                                                </div>
                                                {/* Mobile-only Row 2: controls */}
                                                <div className="flex lg:hidden items-center gap-2 mt-1.5 flex-wrap text-[10px]">
                                                    <select value={item.warehouseId} onChange={e => updateCartWarehouse(idx, e.target.value)}
                                                        className="px-1 py-0.5 rounded border border-gray-200 text-[10px] outline-none">
                                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                    </select>
                                                    <span className={`${(item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock) <= 0 ? 'text-red-500' : (item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock) < 10 ? 'text-orange-500' : 'text-gray-400'}`}>คงเหลือ {item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock}</span>
                                                    {item.productUnits && item.productUnits.length > 0 && (
                                                        <select value={item.selectedUnitId || '__default__'} onChange={e => updateCartUnit(idx, e.target.value)}
                                                            className="px-1 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-[10px] outline-none font-medium">
                                                            {!item.productUnits.some(u => u.isBaseUnit) && (
                                                                <option value="__default__">
                                                                    {products.find(p => p.id === item.productId)?.unit || item.unit} (ปกติ)
                                                                </option>
                                                            )}
                                                            {item.productUnits.map(u => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.unitName} {u.isBaseUnit ? '(หลัก)' : `(×${Number(u.conversionRate)})`}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="text-gray-400">฿</span>
                                                        <input type="number" value={item.unitPrice}
                                                            onChange={e => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                                                            className="w-16 px-1 py-0.5 rounded border border-gray-200 text-[10px] outline-none text-right font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            step="0.01" min={0}
                                                        />
                                                        <span className="text-gray-400">/{item.selectedUnitName}</span>
                                                    </div>
                                                    {/* Mobile item discount */}
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="text-gray-400">ลด:</span>
                                                        <input type="number" value={item.itemDiscount || ''}
                                                            onChange={e => setCart(prev => prev.map((c, ci) => ci === idx ? { ...c, itemDiscount: parseFloat(e.target.value) || 0 } : c))}
                                                            className="w-12 px-1 py-0.5 rounded border border-gray-200 text-[10px] outline-none text-right"
                                                            placeholder="0" step="0.01" min={0} />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <div ref={cartEndRef} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════ Bottom Bar — Summary + Checkout ══════ */}
                <div className="border-t border-emerald-100 bg-gray-50/80 p-3">
                    <div className="max-w-5xl mx-auto space-y-2">
                        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-3">
                            <div>
                                <span className="text-sm opacity-80">รวมทั้งหมด ({cartCount} ชิ้น)</span>
                                {totalPoints > 0 && <span className="text-xs opacity-70 ml-2">+{totalPoints} แต้ม</span>}
                                {(itemDiscountsTotal > 0 || billDiscount > 0) && <span className="text-xs opacity-70 ml-2">ส่วนลด -{formatCurrency(itemDiscountsTotal + billDiscount)}</span>}
                            </div>
                            <p className="text-2xl font-black tracking-tight">{formatCurrency(Math.max(0, total))}</p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={holdSale}
                                disabled={cart.length === 0}
                                className="shrink-0 px-3 py-2.5 rounded-lg text-xs transition-colors bg-white border border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:opacity-40 disabled:cursor-not-allowed">
                                ⏸ พัก
                            </button>
                            {heldSales.length > 0 && (
                                <button type="button" onClick={() => setShowHeldSales(true)}
                                    className="shrink-0 px-3 py-2.5 rounded-lg text-xs transition-colors bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 relative">
                                    📋 รายการพัก
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{heldSales.length}</span>
                                </button>
                            )}
                            <button type="button" onClick={() => setShowBillDiscount(!showBillDiscount)}
                                className={`shrink-0 px-3 py-2.5 rounded-lg text-xs transition-colors ${billDiscount > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                🏷️{billDiscount > 0 ? ` -${formatCurrency(billDiscount)}` : ''}
                            </button>
                            <button type="button" onClick={() => setShowNotes(!showNotes)}
                                className={`shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${saleNotes ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                Note
                            </button>
                            <button
                                onClick={openPaymentModal}
                                disabled={cart.length === 0 || loading}
                                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all py-2.5 text-sm"
                            >
                                💳 ชำระเงิน
                            </button>
                        </div>
                        {showNotes && (
                            <textarea value={saleNotes} onChange={e => setSaleNotes(e.target.value)}
                                rows={2} placeholder="หมายเหตุสำหรับบิลนี้..."
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-emerald-500 resize-none" />
                        )}
                        {showBillDiscount && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">🏷️ ส่วนลดทั้งบิล:</span>
                                <input type="number" value={billDiscount || ''}
                                    onChange={e => setBillDiscount(parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-red-400 text-right font-semibold"
                                    placeholder="0.00" step="0.01" min={0} autoFocus />
                                <span className="text-sm text-gray-500">บาท</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Payment Modal ── */}
            {showPaymentModal && (
                <PaymentModal
                    total={total}
                    loading={loading}
                    onConfirm={confirmPayment}
                    onClose={() => setShowPaymentModal(false)}
                    defaultPrintType={userPrintSetting as 'bill' | 'invoice' | 'none'}
                    allowCredit={!!selectedCustomer}
                />
            )}

            {/* ── Held Sales Modal ── */}
            {showHeldSales && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHeldSales(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold">📋 รายการพัก ({heldSales.length})</h3>
                                <button onClick={() => setShowHeldSales(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                            </div>
                            <p className="text-sm opacity-80 mt-1">เลือกรายการที่ต้องการเปิดขายต่อ</p>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                            {heldSales.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    <p className="text-3xl mb-2">📭</p>
                                    <p className="text-sm">ไม่มีรายการพัก</p>
                                </div>
                            ) : (
                                heldSales.map((held, idx) => {
                                    const itemCount = held.cart.reduce((s, c) => s + c.quantity, 0);
                                    const heldTotal = held.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0) - (held.billDiscount || 0);
                                    const timeStr = new Date(held.heldAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={held.id} className="p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">👤 {held.label}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {itemCount} ชิ้น · {formatCurrency(heldTotal)} · พักเมื่อ {timeStr}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {held.cart.slice(0, 3).map((c, ci) => (
                                                            <span key={ci} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c.productName} ×{c.quantity}</span>
                                                        ))}
                                                        {held.cart.length > 3 && <span className="text-[10px] text-gray-400">+{held.cart.length - 3} อื่นๆ</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                                                    <button onClick={() => resumeSale(idx)}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors">
                                                        ▶️ เปิด
                                                    </button>
                                                    <button onClick={() => deleteHeldSale(idx)}
                                                        className="px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 text-xs transition-colors">
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {cart.length > 0 && heldSales.length > 0 && (
                            <div className="border-t border-gray-100 px-4 py-3 bg-amber-50">
                                <p className="text-xs text-amber-700">💡 ตะกร้าปัจจุบันมีสินค้าอยู่ — เมื่อเปิดรายการพัก ตะกร้าปัจจุบันจะถูกพักไว้โดยอัตโนมัติ</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AlertModal
                open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message}
                type={alertModal.type}
                title={alertModal.title}
            />
        </div>
    );
}

