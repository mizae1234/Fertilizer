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
    id: string; code: string; name: string; unit: string;
    pointsPerUnit: number;
    productStocks: { warehouseId: string; quantity: number }[];
    productPrices: { customerGroupId: string; price: string; customerGroup: { id: string; name: string } }[];
    productUnits: ProductUnitInfo[];
}
interface Warehouse { id: string; name: string; }
interface CustomerGroup { id: string; name: string; }
interface Customer { id: string; name: string; phone: string; customerGroup: { id: string; name: string } }
interface CartItem {
    productId: string; productName: string; productCode: string; unit: string;
    warehouseId: string; quantity: number; unitPrice: number; points: number;
    availableStock: number; pointsPerUnit: number;
    priceTier: string;
    productPrices: { customerGroupId: string; price: number }[];
    // Multi-unit fields
    selectedUnitId: string;
    selectedUnitName: string;
    conversionRate: number;
    productUnits: ProductUnitInfo[];
}

interface PaymentLine { method: string; amount: number; dueDate: string }
const PAYMENT_METHODS = [
    { value: 'CASH', label: '💵 เงินสด', color: 'emerald' },
    { value: 'CREDIT_CARD', label: '💳 บัตรเครดิต', color: 'blue' },
    { value: 'CREDIT', label: '📋 เครดิต', color: 'amber' },
];

function PaymentModal({ total, loading, onConfirm, onClose }: {
    total: number; loading: boolean;
    onConfirm: (payments: { method: string; amount: number; dueDate?: string }[]) => void;
    onClose: () => void;
}) {
    const [lines, setLines] = useState<PaymentLine[]>([
        { method: 'CASH', amount: total, dueDate: '' }
    ]);

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
        setLines([...lines, { method: 'CASH', amount: Math.round(rem * 100) / 100, dueDate: '' }]);
    };
    const setFullAmount = (idx: number) => {
        const otherSum = lines.reduce((s, l, i) => i === idx ? s : s + (l.amount || 0), 0);
        updateLine(idx, { amount: Math.round((total - otherSum) * 100) / 100 });
    };

    const handleConfirm = () => {
        const payments = lines.map(l => ({
            method: l.method,
            amount: l.amount,
            ...(l.method === 'CREDIT' && l.dueDate ? { dueDate: l.dueDate } : {}),
        }));
        onConfirm(payments);
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
                                        onClick={() => updateLine(idx, { method: m.value, dueDate: m.value !== 'CREDIT' ? '' : line.dueDate })}
                                        className={`flex-1 rounded-lg text-xs font-medium py-1.5 transition-all ${line.method === m.value
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                                            }`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>

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
    const [showCart, setShowCart] = useState(false);
    const [reviewMode, setReviewMode] = useState(false);

    // Track which items just had quantity changes (for pulse animation)
    const [pulsingItems, setPulsingItems] = useState<Set<string>>(new Set());
    // Track last added item index for slide-in animation
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const cartEndRef = useRef<HTMLDivElement>(null);

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
        ]).then(([w, cg]) => {
            setWarehouses(w);
            setCustomerGroups(cg);
            if (w.length > 0) setDefaultWarehouseId(w[0].id);
        });
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

    useEffect(() => {
        if (showCart) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showCart]);

    const getPrice = (product: Product): number => {
        if (selectedCustomer) {
            const groupPrice = product.productPrices.find(
                p => p.customerGroup.id === selectedCustomer.customerGroup.id
            );
            if (groupPrice) return Number(groupPrice.price);
        }
        return product.productPrices.length > 0 ? Number(product.productPrices[0].price) : 0;
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
            // Use unit selling price if available, otherwise fallback to product price
            let price = selectedUnit ? Number(selectedUnit.sellingPrice) : getPrice(product);
            let priceTier = 'custom';
            if (!selectedUnit) {
                if (selectedCustomer) {
                    const gp = product.productPrices.find(p => p.customerGroup.id === selectedCustomer.customerGroup.id);
                    if (gp) priceTier = selectedCustomer.customerGroup.id;
                } else if (product.productPrices.length > 0) {
                    priceTier = product.productPrices[0].customerGroup.id;
                }
            }
            setCart([...cart, {
                productId: product.id, productName: product.name, productCode: product.code,
                unit: unitName, warehouseId, quantity: 1, unitPrice: price,
                points: product.pointsPerUnit, availableStock: stock,
                pointsPerUnit: product.pointsPerUnit,
                priceTier,
                productPrices: product.productPrices.map(pp => ({ customerGroupId: pp.customerGroup.id, price: Number(pp.price) })),
                selectedUnitId: selectedUnit?.id || '',
                selectedUnitName: unitName,
                conversionRate: convRate,
                productUnits: product.productUnits || [],
            }]);
            setLastAddedId(product.id);
            setTimeout(() => setLastAddedId(null), 400);
            setTimeout(() => cartEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
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

    const updateCartPriceTier = (idx: number, tier: string) => {
        setCart(cart.map((c, i) => {
            if (i !== idx) return c;
            if (tier === 'custom') return { ...c, priceTier: 'custom' };
            const groupPrice = c.productPrices.find(pp => pp.customerGroupId === tier);
            return { ...c, priceTier: tier, unitPrice: groupPrice?.price || c.unitPrice };
        }));
    };

    const updateCartUnit = (idx: number, unitId: string) => {
        setCart(cart.map((c, i) => {
            if (i !== idx) return c;
            const product = products.find(p => p.id === c.productId);
            const baseStock = product ? getStock(product, c.warehouseId) : 0;

            // "default" = product's original unit (no productUnit record)
            if (unitId === '__default__') {
                const price = product ? getPrice(product) : c.unitPrice;
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
            return {
                ...c,
                selectedUnitId: unit.id,
                selectedUnitName: unit.unitName,
                conversionRate: convRate,
                unitPrice: Number(unit.sellingPrice),
                unit: unit.unitName,
                availableStock: baseStock,
                priceTier: 'custom',
            };
        }));
    };

    const total = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
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

    const confirmPayment = async (payments: { method: string; amount: number; dueDate?: string }[]) => {
        setLoading(true);
        try {
            await createSaleFromPOS({
                customerId: selectedCustomer?.id,
                items: cart.map(c => ({
                    productId: c.productId, warehouseId: c.warehouseId,
                    quantity: c.quantity, unitPrice: c.unitPrice, points: c.points,
                    conversionRate: c.conversionRate,
                })),
                userId,
                payments,
                notes: saleNotes.trim() || undefined,
            });
            setShowPaymentModal(false);
            setAlertModal({ open: true, message: 'สร้างบิลขายเรียบร้อย ตัด stock แล้ว', type: 'success', title: 'ชำระเงินสำเร็จ!' });
            setCart([]);
            setShowCart(false);
            setReviewMode(false);
            setSaleNotes('');
            setShowNotes(false);
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

    // ─── Cart Panel Content ─── (render function, NOT a component)
    const renderCartContent = (isMobile = false) => {
        const isReview = !isMobile && reviewMode;
        const isDesktop = !isMobile;

        return (
            <>
                {/* Customer Selection */}
                <div className={`border-b border-gray-100 ${isDesktop ? 'p-5' : 'p-4'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <label className={`font-medium text-gray-600 ${isDesktop ? 'text-base' : 'text-sm'}`}>ลูกค้า</label>
                        <button onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                            className={`text-emerald-600 hover:underline ${isDesktop ? 'text-sm' : 'text-xs'}`}>
                            {selectedCustomer ? 'เปลี่ยน' : 'เลือกลูกค้า'}
                        </button>
                    </div>
                    {selectedCustomer ? (
                        <div className={`flex items-center justify-between bg-emerald-50 rounded-xl ${isDesktop ? 'p-4' : 'p-3'}`}>
                            <div>
                                <p className={`font-medium text-gray-800 ${isDesktop ? 'text-base' : 'text-sm'}`}>{selectedCustomer.name}</p>
                                <p className={`text-gray-500 ${isDesktop ? 'text-sm' : 'text-xs'}`}>{selectedCustomer.customerGroup.name} · {selectedCustomer.phone}</p>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                        </div>
                    ) : (
                        <p className={`text-gray-400 ${isDesktop ? 'text-base' : 'text-sm'}`}>ลูกค้าทั่วไป</p>
                    )}

                    {showCustomerPicker && (
                        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                            <input
                                type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                                className="w-full px-3 py-2 text-sm border-b border-gray-100 outline-none"
                            />
                            <div className="max-h-40 overflow-y-auto">
                                {customers.map(c => (
                                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                                        {c.name} · {c.phone}
                                        <span className="text-xs text-gray-400 ml-1">({c.customerGroup.name})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Cart Items */}
                <div className={`flex-1 overflow-y-auto space-y-2 ${isDesktop ? 'p-4' : 'p-3'}`}>
                    {cart.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-4xl mb-3">🛒</p>
                            <p className="text-sm">ยังไม่มีสินค้าในตะกร้า</p>
                            <p className="text-xs text-gray-300 mt-1">กดสินค้าทางซ้ายเพื่อเพิ่ม</p>
                        </div>
                    ) : (
                        <>
                            {cart.map((item, idx) => (
                                <div
                                    key={item.productId}
                                    className={`rounded-lg transition-all ${pulsingItems.has(item.productId) ? 'animate-cart-pulse' : ''
                                        } ${lastAddedId === item.productId ? 'animate-cart-slide-in' : ''
                                        } ${isDesktop
                                            ? 'bg-white border border-gray-100 p-3 shadow-sm'
                                            : 'bg-gray-50 p-2.5'
                                        }`}
                                >
                                    {/* Row 1: Product name + qty controls + line total */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{item.productName}</p>
                                            <p className="text-[11px] text-gray-400">{item.productCode} · {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => updateCartQty(idx, item.quantity - 1)}
                                                className="w-7 h-7 rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
                                            >−</button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    if (val >= 0 && val <= item.availableStock) {
                                                        updateCartQty(idx, val);
                                                    }
                                                }}
                                                onBlur={e => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    updateCartQty(idx, Math.max(1, Math.min(val, item.availableStock)));
                                                }}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                className="font-bold text-sm text-center w-10 rounded-md border border-gray-200 py-0.5 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                min={1}
                                                max={item.availableStock}
                                            />
                                            <button
                                                onClick={() => updateCartQty(idx, item.quantity + 1)}
                                                disabled={item.quantity >= item.availableStock}
                                                className="w-7 h-7 rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >+</button>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-600 shrink-0 w-24 text-right">
                                            {formatCurrency(item.quantity * item.unitPrice)}
                                        </p>
                                        <button onClick={() => removeFromCart(idx)}
                                            className="text-red-300 hover:text-red-500 text-xs shrink-0 ml-1">✕</button>
                                    </div>

                                    {/* Row 2: Selectors — hidden in review mode */}
                                    {!isReview && (
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <label className="text-[10px] text-gray-400 shrink-0">คลัง:</label>
                                                <select
                                                    value={item.warehouseId}
                                                    onChange={e => updateCartWarehouse(idx, e.target.value)}
                                                    className="px-1.5 py-0.5 rounded border border-gray-200 text-[11px] outline-none"
                                                >
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                                <span className="text-[10px] text-gray-400">({item.conversionRate > 1 ? Math.floor(item.availableStock / item.conversionRate) : item.availableStock})</span>
                                            </div>
                                            {item.productUnits && item.productUnits.length > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <label className="text-[10px] text-gray-400 shrink-0">หน่วย:</label>
                                                    <select
                                                        value={item.selectedUnitId || '__default__'}
                                                        onChange={e => updateCartUnit(idx, e.target.value)}
                                                        className="px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-[11px] outline-none font-medium"
                                                    >
                                                        {/* Always show product's default unit if no base unit in productUnits */}
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
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <label className="text-[10px] text-gray-400 shrink-0">ราคา:</label>
                                                <select
                                                    value={item.priceTier}
                                                    onChange={e => updateCartPriceTier(idx, e.target.value)}
                                                    className="px-1.5 py-0.5 rounded border border-gray-200 text-[11px] outline-none"
                                                >
                                                    {item.productPrices.map(pp => {
                                                        const grp = customerGroups.find(g => g.id === pp.customerGroupId);
                                                        return <option key={pp.customerGroupId} value={pp.customerGroupId}>{grp?.name || 'กลุ่ม'} ({formatCurrency(pp.price)})</option>;
                                                    })}
                                                    <option value="custom">กำหนดเอง</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <label className="text-[10px] text-gray-400 shrink-0">฿</label>
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={e => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-1.5 py-0.5 rounded border border-gray-200 text-[11px] outline-none text-right font-semibold"
                                                    step="0.01" min={0}
                                                />
                                                <span className="text-[10px] text-gray-400">/{item.unit}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={cartEndRef} />
                        </>
                    )}
                </div>

                {/* Cart Summary — Sticky Bottom */}
                <div className="border-t border-emerald-100 bg-gray-50/80 p-3 space-y-2">
                    {/* Grand Total — compact green bar */}
                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2.5">
                        <div>
                            <span className="text-xs opacity-80">รวมทั้งหมด ({cartCount} ชิ้น)</span>
                            {totalPoints > 0 && <span className="text-[10px] opacity-70 ml-2">+{totalPoints} แต้ม</span>}
                        </div>
                        <p className="text-2xl font-black tracking-tight">{formatCurrency(total)}</p>
                    </div>

                    {/* Notes toggle + Checkout in one row */}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setShowNotes(!showNotes)}
                            className={`shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors ${saleNotes ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                            📝 {showNotes ? '▲' : '▼'}
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
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-emerald-500 resize-none" />
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="animate-fade-in -m-4 lg:-m-6">
            <div className="flex h-[calc(100dvh-3.5rem)] lg:h-screen">
                {/* ══════ Left: Products ══════ */}
                <div
                    className="flex-1 flex flex-col bg-gray-50 overflow-hidden"
                    style={{
                        transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    {/* Top bar */}
                    <div className="bg-white border-b border-gray-200 p-3 sm:p-4 lg:pt-6">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <h1 className="text-base sm:text-lg font-bold text-gray-800 shrink-0">🛒 POS</h1>
                            <div className="flex-1" />
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <label className="text-xs sm:text-sm text-gray-500 hidden sm:inline">คลัง:</label>
                                <select
                                    value={defaultWarehouseId}
                                    onChange={e => setDefaultWarehouseId(e.target.value)}
                                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-gray-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium max-w-[120px] sm:max-w-none"
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-2 sm:mt-3">
                            <input
                                type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="🔍 ค้นหาสินค้า..."
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                            />
                        </div>

                        {/* Mobile: Customer Selector */}
                        <div className="lg:hidden mt-2">
                            {selectedCustomer ? (
                                <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs">👤</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{selectedCustomer.name}</p>
                                            <p className="text-xs text-gray-500">{selectedCustomer.customerGroup.name} · {selectedCustomer.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => setShowCustomerPicker(!showCustomerPicker)} className="text-xs text-emerald-600 px-2 py-1">เปลี่ยน</button>
                                        <button onClick={() => setSelectedCustomer(null)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-emerald-400 hover:text-emerald-600">
                                    <span>👤</span> เลือกลูกค้า
                                </button>
                            )}
                            {showCustomerPicker && (
                                <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-lg">
                                    <input
                                        type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                                        placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                                        className="w-full px-3 py-2 text-sm border-b border-gray-100 outline-none"
                                    />
                                    <div className="max-h-40 overflow-y-auto">
                                        {customers.map(c => (
                                            <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                                                {c.name} · {c.phone}
                                                <span className="text-xs text-gray-400 ml-1">({c.customerGroup.name})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Grid — centered */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                        <div className="max-w-5xl mx-auto">
                            <div className={`grid gap-2 sm:gap-3 ${reviewMode
                                ? 'grid-cols-2 lg:grid-cols-2'
                                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                                }`}>
                                {filteredProducts.map(product => {
                                    const stock = getStock(product, defaultWarehouseId);
                                    const price = getPrice(product);
                                    const outOfStock = stock <= 0;
                                    const inCart = cart.find(c => c.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className={`rounded-xl text-left transition-all relative ${reviewMode ? 'p-2.5' : 'p-3 sm:p-4'
                                                } ${inCart
                                                    ? 'bg-emerald-50 border-2 border-emerald-300 shadow-sm'
                                                    : outOfStock
                                                        ? 'bg-orange-50 border border-orange-200 shadow-sm hover:shadow-md active:scale-[0.97]'
                                                        : 'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-[0.97]'
                                                }`}
                                        >
                                            {inCart && (
                                                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                                                    {inCart.quantity}
                                                </span>
                                            )}
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-mono text-gray-400 ${reviewMode ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}>{product.code}</span>
                                                <span className={`font-semibold ${reviewMode ? 'text-[9px]' : 'text-[10px] sm:text-xs'} ${outOfStock ? 'text-red-500' : stock < 10 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                                    {stock}
                                                </span>
                                            </div>
                                            <p className={`font-medium text-gray-800 mb-1 line-clamp-2 leading-tight ${reviewMode ? 'text-xs' : 'text-xs sm:text-sm'}`}>{product.name}</p>
                                            <p className={`font-bold text-emerald-600 ${reviewMode ? 'text-xs' : 'text-xs sm:text-sm'}`}>{formatCurrency(price)}</p>
                                            {!reviewMode && product.pointsPerUnit > 0 && (
                                                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">+{product.pointsPerUnit} แต้ม</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ Right: Cart Panel (Desktop) ══════ */}
                <div
                    className="hidden lg:flex bg-white border-l border-gray-200 flex-col overflow-hidden"
                    style={{
                        width: '65%',
                        minWidth: '500px',
                    }}
                >
                    {/* Mode Toggle Header */}
                    <div className="p-4 pb-3 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
                                <button
                                    onClick={() => setReviewMode(false)}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${!reviewMode
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    🛒 โหมดขาย
                                </button>
                                <button
                                    onClick={() => setReviewMode(true)}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${reviewMode
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    📋 โหมดทวนลูกค้า
                                </button>
                            </div>
                            {cart.length > 0 && (
                                <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                                    {cartCount}
                                </span>
                            )}
                        </div>
                    </div>
                    {renderCartContent()}
                </div>
            </div>

            {/* ── Mobile: Floating Cart Button ── */}
            {!showCart && (
                <button
                    onClick={() => setShowCart(true)}
                    className="lg:hidden fixed bottom-6 right-4 z-40 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-xl shadow-emerald-300/40 active:scale-95 transition-transform"
                >
                    <span className="text-lg">🛒</span>
                    {cartCount > 0 ? (
                        <>
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{cartCount}</span>
                            <span className="text-sm">{formatCurrency(total)}</span>
                        </>
                    ) : (
                        <span className="text-sm">ตะกร้า</span>
                    )}
                </button>
            )}

            {/* ── Mobile: Cart Bottom Sheet ── */}
            {showCart && (
                <>
                    <div
                        className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowCart(false)}
                    />
                    <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl flex flex-col shadow-2xl"
                        style={{ maxHeight: '92dvh' }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🛒</span>
                                <h2 className="font-bold text-gray-800">ตะกร้า</h2>
                                {cartCount > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {cartCount} ชิ้น
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowCart(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {renderCartContent(true)}
                    </div>
                </>
            )}

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
