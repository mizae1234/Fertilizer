'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    productUnits: ProductUnitInfo[];
    // Bundle fields
    isBundle?: boolean;
    bundleId?: string;
    bundleName?: string;
    bundleItems?: BundleSubItem[];
    // Discount
    itemDiscount: number;
}

interface PaymentLine { method: string; amount: number; dueDate: string; bankAccountId?: string }
interface BankAccountInfo { id: string; accountName: string; accountNumber: string; bankName: string; qrCodeUrl: string | null; isDefault: boolean; isActive: boolean }
const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 เงินสด', color: 'emerald' },
    { value: 'TRANSFER', label: '🏦 เงินโอน', color: 'blue' },
    { value: 'CREDIT', label: '📋 เครดิต', color: 'amber' },
];

function PaymentModal({ total, loading, onConfirm, onClose }: {
    total: number; loading: boolean;
    onConfirm: (payments: { method: string; amount: number; dueDate?: string }[], printType: 'bill' | 'invoice') => void;
    onClose: () => void;
}) {
    const [lines, setLines] = useState<PaymentLine[]>([
        { method: 'CASH', amount: total, dueDate: '' }
    ]);
    const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>([]);
    const [printType, setPrintType] = useState<'bill' | 'invoice'>('bill');

    // Fetch bank accounts on mount
    useEffect(() => {
        fetch('/api/bank-accounts').then(r => r.json()).then((data: BankAccountInfo[]) => {
            const active = data.filter(a => a.isActive);
            setBankAccounts(active);
        }).catch(console.error);
    }, []);

    const paid = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const remaining = total - paid;
    const isValid = Math.abs(remaining) < 0.01 && lines.every(l =>
        l.amount > 0 && (l.method !== 'CREDIT' || l.dueDate)
    );

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
        onConfirm(payments, printType);
    };

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
                                {PAYMENT_METHODS.map(m => (
                                    <button key={m.value} type="button"
                                        onClick={() => handleMethodChange(idx, m.value)}
                                        className={`flex-1 rounded-lg text-xs font-medium py-1.5 transition-all ${line.method === m.value
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                                            }`}>
                                        {m.label}
                                    </button>
                                ))}
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
                        </div>
                    </div>
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
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [userId, setUserId] = useState('');
    const [search, setSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);


    // Track which items just had quantity changes (for pulse animation)
    const [pulsingItems, setPulsingItems] = useState<Set<string>>(new Set());
    // Track last added item index for slide-in animation
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const cartEndRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchInputMobileRef = useRef<HTMLInputElement>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Bill-level discount
    const [billDiscount, setBillDiscount] = useState(0);
    const [showBillDiscount, setShowBillDiscount] = useState(false);

    // Cart persistence via sessionStorage
    const CART_STORAGE_KEY = 'pos_cart';
    const CUSTOMER_STORAGE_KEY = 'pos_customer';
    const cartInitialized = useRef(false);

    useEffect(() => {
        try {
            const token = document.cookie.split('; ').find(c => c.startsWith('token='))?.split('=')[1];
            if (token) {
                const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1]), c => c.charCodeAt(0))));
                if (payload.userId) setUserId(payload.userId);
            }
        } catch { /* ignore */ }

        Promise.all([
            fetch('/api/warehouses').then(r => r.json()),
            fetch('/api/customer-groups').then(r => r.json()),
            fetch('/api/bundles').then(r => r.json()).catch(() => []),
        ]).then(([w, cg, b]) => {
            setWarehouses(w);
            setCustomerGroups(cg);
            setBundles(b);
            if (w.length > 0) setDefaultWarehouseId(w[0].id);
        });

        // Restore cart + customer from sessionStorage
        try {
            const savedCart = sessionStorage.getItem(CART_STORAGE_KEY);
            if (savedCart) setCart(JSON.parse(savedCart));
            const savedCustomer = sessionStorage.getItem(CUSTOMER_STORAGE_KEY);
            if (savedCustomer) setSelectedCustomer(JSON.parse(savedCustomer));
        } catch { /* ignore */ }
        cartInitialized.current = true;
    }, []);

    const loadProducts = useCallback(async (warehouseId: string) => {
        const res = await fetch(`/api/products?warehouseId=${warehouseId}`);
        const data = await res.json();
        setProducts(data);
    }, []);

    useEffect(() => {
        if (defaultWarehouseId) loadProducts(defaultWarehouseId);
    }, [defaultWarehouseId, loadProducts]);

    useEffect(() => {
        if (customerSearch) {
            fetch(`/api/customers?search=${customerSearch}`).then(r => r.json()).then(setCustomers);
        }
    }, [customerSearch]);

    // Persist cart to sessionStorage
    useEffect(() => {
        if (!cartInitialized.current) return;
        try { sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
    }, [cart]);
    useEffect(() => {
        if (!cartInitialized.current) return;
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

        // Determine base unit from productUnits
        const baseUnit = product.productUnits?.find(u => u.isBaseUnit);
        const selectedUnit = baseUnit || null;
        const convRate = selectedUnit ? Number(selectedUnit.conversionRate) : 1;
        const unitName = selectedUnit ? selectedUnit.unitName : product.unit;

        const existing = cart.find(c => c.productId === product.id && c.warehouseId === warehouseId && c.selectedUnitId === (selectedUnit?.id || ''));
        if (existing) {
            setCart(cart.map(c =>
                c.productId === product.id && c.warehouseId === warehouseId && c.selectedUnitId === (selectedUnit?.id || '')
                    ? { ...c, quantity: c.quantity + 1, points: (c.quantity + 1) * c.pointsPerUnit }
                    : c
            ));
            triggerPulse(product.id);
        } else {
            // Auto-determine price based on customer group + unit
            let price = selectedUnit ? Number(selectedUnit.sellingPrice) : getPrice(product);
            const priceTier = 'custom';
            if (selectedCustomer) {
                const unitId = selectedUnit?.id || null;
                const gp = product.productPrices.find(p =>
                    p.customerGroup.id === selectedCustomer.customerGroup.id && p.productUnitId === unitId
                );
                if (gp) price = Number(gp.price);
            }
            setCart([...cart, {
                productId: product.id, productName: product.name, productCode: product.code,
                unit: unitName, warehouseId, quantity: 1, unitPrice: price,
                points: product.pointsPerUnit, availableStock: stock,
                pointsPerUnit: product.pointsPerUnit,
                priceTier,
                productPrices: product.productPrices.map(pp => ({ customerGroupId: pp.customerGroup.id, productUnitId: pp.productUnitId, price: Number(pp.price) })),
                selectedUnitId: selectedUnit?.id || '',
                selectedUnitName: unitName,
                conversionRate: convRate,
                productUnits: product.productUnits || [],
                itemDiscount: 0,
            }]);
            setLastAddedId(product.id);
            setTimeout(() => setLastAddedId(null), 400);
            setTimeout(() => cartEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
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

        // Check if same bundle already in cart → increment qty
        const existing = cart.find(c => c.isBundle && c.bundleId === bundle.id);
        if (existing) {
            setCart(prev => prev.map(c =>
                c.isBundle && c.bundleId === bundle.id
                    ? {
                        ...c,
                        quantity: c.quantity + 1,
                        bundleItems: c.bundleItems?.map(si => ({ ...si, quantity: si.quantity / (c.quantity) * (c.quantity + 1) })),
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
    };

    const updateCartQty = (idx: number, qty: number) => {
        if (qty <= 0) { removeFromCart(idx); return; }
        const item = cart[idx];
        setCart(cart.map((c, i) => i === idx ? { ...c, quantity: qty, points: qty * c.pointsPerUnit } : c));
        triggerPulse(item.productId);
    };

    const updateCartWarehouse = (idx: number, warehouseId: string) => {
        const item = cart[idx];
        const product = products.find(p => p.id === item.productId);
        const stock = product ? getStock(product, warehouseId) : 0;
        setCart(cart.map((c, i) => i === idx ? { ...c, warehouseId, availableStock: stock } : c));
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
            const baseStock = product ? getStock(product, c.warehouseId) : 0;

            // "default" = product's original unit (no productUnit record)
            if (unitId === '__default__') {
                let price = product ? getPrice(product) : c.unitPrice;
                // Auto-lookup group price for base unit
                if (selectedCustomer) {
                    const gp = c.productPrices.find(pp =>
                        pp.customerGroupId === selectedCustomer.customerGroup.id && pp.productUnitId === null
                    );
                    if (gp) price = gp.price;
                }
                return {
                    ...c,
                    selectedUnitId: '',
                    selectedUnitName: product?.unit || c.unit,
                    conversionRate: 1,
                    unitPrice: price,
                    unit: product?.unit || c.unit,
                    availableStock: baseStock,
                    priceTier: 'custom',
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
                unit: unit.unitName,
                availableStock: baseStock,
                priceTier: 'custom',
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

    const confirmPayment = async (payments: { method: string; amount: number; dueDate?: string }[], printType: 'bill' | 'invoice') => {
        setLoading(true);
        try {
            // Expand bundle items into individual product items for stock deduction
            const saleItems: { productId: string; warehouseId: string; quantity: number; unitPrice: number; points: number; conversionRate: number }[] = [];
            for (const c of cart) {
                if (c.isBundle && c.bundleItems) {
                    for (const si of c.bundleItems) {
                        saleItems.push({
                            productId: si.productId, warehouseId: si.warehouseId,
                            quantity: si.quantity * c.quantity, unitPrice: si.unitPrice, points: si.points * c.quantity,
                            conversionRate: 1,
                        });
                    }
                } else {
                    saleItems.push({
                        productId: c.productId, warehouseId: c.warehouseId,
                        quantity: c.quantity, unitPrice: c.unitPrice, points: c.points,
                        conversionRate: c.conversionRate,
                    });
                }
            }
            const result = await createSaleFromPOS({
                customerId: selectedCustomer?.id,
                items: saleItems,
                userId,
                payments,
                notes: saleNotes.trim() || undefined,
            });
            setShowPaymentModal(false);
            setCart([]);
            setBillDiscount(0);
            setShowBillDiscount(false);
            setSaleNotes('');
            setShowNotes(false);

            // Auto-print based on selected print type
            if (result?.id) {
                if (printType === 'bill') {
                    // TODO: ปิดไว้ชั่วคราว — รอ set Chrome kiosk-printing ก่อน
                    // Silent print via hidden iframe
                    // const iframe = document.createElement('iframe');
                    // iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none';
                    // iframe.src = `/invoice/${result.id}?silent=1`;
                    // document.body.appendChild(iframe);
                    // iframe.onload = () => {
                    //     setTimeout(() => {
                    //         try { iframe.contentWindow?.print(); } catch {}
                    //         setTimeout(() => iframe.remove(), 3000);
                    //     }, 800);
                    // };
                } else {
                    // Open A4 invoice in new tab
                    window.open(`/invoice/${result.id}`, '_blank');
                }
            }

            // Show success and reload products for updated stock
            setAlertModal({ open: true, message: `สร้างบิลขาย ${result?.saleNumber || ''} เรียบร้อย ตัด stock แล้ว`, type: 'success', title: 'ชำระเงินสำเร็จ!' });
            if (defaultWarehouseId) loadProducts(defaultWarehouseId);
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

    const filteredProducts = products.filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
    );

    const filteredBundles = bundles.filter(b =>
        !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.code.toLowerCase().includes(search.toLowerCase())
    );


    const searchRef = useRef<HTMLDivElement>(null);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const searchResults = search.length > 0
        ? [...filteredProducts.map(p => ({ type: 'product' as const, data: p })),
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
            setHighlightedIndex(prev => (prev + 1) % searchResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev <= 0 ? searchResults.length - 1 : prev - 1));
        } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
            e.preventDefault();
            const r = searchResults[highlightedIndex];
            if (r.type === 'product') { addToCart(r.data as Product); }
            else { addBundleToCart(r.data as BundleInfo); }
            setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1);
        }
    };

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
                                <div ref={searchRef} className="relative w-80 shrink-0">
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
                                                            onClick={() => { addToCart(p); setSearch(''); setShowSearchResults(false); setHighlightedIndex(-1); }}
                                                            className={`w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-emerald-100' : inCart ? 'bg-emerald-50/50' : ''}`}>
                                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-mono text-gray-400 shrink-0">📦</div>
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
                            <div ref={searchRef} className="relative">
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
                                                        className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${i === highlightedIndex ? 'bg-emerald-100' : inCart ? 'bg-emerald-50/50' : ''}`}>
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
                                                        <p className="text-[10px] lg:text-xs text-purple-400">{item.productCode} · {formatCurrency(item.unitPrice)}/ชุด</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => updateCartQty(idx, item.quantity - 1)}
                                                            className="w-6 h-6 lg:w-8 lg:h-8 rounded bg-purple-100 border border-purple-200 text-purple-600 text-xs flex items-center justify-center">−</button>
                                                        <span className="font-bold text-xs lg:text-sm w-6 text-center text-purple-700">{item.quantity}</span>
                                                        <button onClick={() => updateCartQty(idx, item.quantity + 1)}
                                                            className="w-6 h-6 lg:w-8 lg:h-8 rounded bg-purple-100 border border-purple-200 text-purple-600 text-xs flex items-center justify-center">+</button>
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
                                                        <p className="text-[10px] lg:hidden text-gray-400">{item.productCode} · {formatCurrency(item.unitPrice)}/{item.unit}</p>
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
                                                                className="w-20 px-1 py-0.5 rounded border border-gray-200 text-[11px] outline-none text-right font-semibold"
                                                                step="0.01" min={0}
                                                            />
                                                            <span className="text-gray-400">/{item.unit}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => updateCartQty(idx, item.quantity - 1)}
                                                            className="w-6 h-6 lg:w-7 lg:h-7 rounded bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-center justify-center">−</button>
                                                        <input type="number" value={item.quantity}
                                                            onChange={e => { const val = parseInt(e.target.value) || 0; if (val >= 0 && val <= item.availableStock) updateCartQty(idx, val); }}
                                                            onBlur={e => { const val = parseInt(e.target.value) || 1; updateCartQty(idx, Math.max(1, Math.min(val, item.availableStock))); }}
                                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                            className="font-bold text-xs lg:text-sm text-center w-8 lg:w-10 rounded border border-gray-200 py-0.5 outline-none focus:ring-1 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            min={1} max={item.availableStock}
                                                        />
                                                        <button onClick={() => updateCartQty(idx, item.quantity + 1)}
                                                            disabled={item.quantity >= item.availableStock}
                                                            className="w-6 h-6 lg:w-7 lg:h-7 rounded bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-center justify-center disabled:opacity-50">+</button>
                                                    </div>
                                                    <p className="text-xs lg:text-sm font-bold text-emerald-600 shrink-0 min-w-[60px] lg:min-w-[80px] text-right">{formatCurrency(item.quantity * item.unitPrice)}</p>
                                                    <button onClick={() => removeFromCart(idx)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                                                </div>
                                                {/* Item discount row */}
                                                <div className="hidden lg:flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-400">ส่วนลด:</span>
                                                    <input type="number" value={item.itemDiscount || ''}
                                                        onChange={e => setCart(prev => prev.map((c, ci) => ci === idx ? { ...c, itemDiscount: parseFloat(e.target.value) || 0 } : c))}
                                                        className="w-20 px-1.5 py-0.5 rounded border border-gray-200 text-xs outline-none text-right"
                                                        placeholder="0" step="0.01" min={0} />
                                                    <span className="text-[10px] text-gray-400">บาท</span>
                                                </div>
                                                {/* Mobile-only Row 2: controls */}
                                                <div className="flex lg:hidden items-center gap-2 mt-1.5 flex-wrap text-[10px]">
                                                    <select value={item.warehouseId} onChange={e => updateCartWarehouse(idx, e.target.value)}
                                                        className="px-1 py-0.5 rounded border border-gray-200 text-[10px] outline-none">
                                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                    </select>
                                                    <span className="text-gray-400">({item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock})</span>
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
                                                            className="w-16 px-1 py-0.5 rounded border border-gray-200 text-[10px] outline-none text-right font-semibold"
                                                            step="0.01" min={0}
                                                        />
                                                        <span className="text-gray-400">/{item.unit}</span>
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
                            <button type="button" onClick={() => setShowBillDiscount(!showBillDiscount)}
                                className={`shrink-0 px-3 py-2.5 rounded-lg text-xs transition-colors ${billDiscount > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                🏷️ ส่วนลด{billDiscount > 0 ? ` -${formatCurrency(billDiscount)}` : ''}
                            </button>
                            <button type="button" onClick={() => setShowNotes(!showNotes)}
                                className={`shrink-0 px-3 py-2.5 rounded-lg text-xs transition-colors ${saleNotes ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                📝 Note
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
                />
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

