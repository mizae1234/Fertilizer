'use client';

import { useEffect, useState } from 'react';

interface SaleData {
    id: string;
    saleNumber: string;
    status: string;
    totalAmount: number;
    discount: number;
    paymentMethod: string;
    creditDueDate: string | null;
    payments: { method: string; amount: number; dueDate?: string }[] | null;
    notes: string | null;
    debtPaid: number;
    createdAt: string;
    customer: { name: string; phone: string; address?: string | null; taxId?: string | null } | null;
    createdBy: { name: string };
    items: {
        id: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        discount?: number;
        unitName?: string | null;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string; id: string };
    }[];
}

interface TemplateData {
    id: string;
    showLogo: boolean;
    logoUrl: string | null;
    headerText: string;
    footerText: string;
    specialNote: string | null;
    showBillNo: boolean;
    showVat: boolean;
    showQr: boolean;
    qrCodeUrl?: string | null;
    showStaff: boolean;
    showCustomer: boolean;
}

function formatCurrency(n: number) {
    return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
        new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

// Thai number to text
function numberToThaiText(num: number): string {
    if (num === 0) return 'ศูนย์บาทถ้วน';
    const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);

    function groupToText(n: number): string {
        if (n === 0) return '';
        const str = String(n);
        let result = '';
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const d = parseInt(str[i]);
            const pos = len - i - 1;
            if (d === 0) continue;
            if (pos === 1 && d === 1) { result += 'สิบ'; continue; }
            if (pos === 1 && d === 2) { result += 'ยี่สิบ'; continue; }
            if (pos === 0 && d === 1 && len > 1) { result += 'เอ็ด'; continue; }
            result += digits[d] + positions[pos];
        }
        return result;
    }

    let text = '';
    if (intPart >= 1000000) {
        text += groupToText(Math.floor(intPart / 1000000)) + 'ล้าน';
        text += groupToText(intPart % 1000000);
    } else {
        text += groupToText(intPart);
    }
    text += 'บาท';

    if (decPart > 0) {
        text += groupToText(decPart) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    return '(' + text + ')';
}

export default function InvoicePrint({ sale, template }: { sale: SaleData; template: TemplateData | null }) {
    const [title, setTitle] = useState('ใบส่งของ');
    const [showChooser, setShowChooser] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('invoice_items_per_page');
                if (saved && !isNaN(parseInt(saved))) {
                    return Math.max(3, Math.min(30, parseInt(saved)));
                }
            } catch (e) {}
        }
        return 10;
    });

    const handleItemsPerPageChange = (val: number) => {
        const clamped = Math.max(3, Math.min(30, val));
        setItemsPerPage(clamped);
        try {
            localStorage.setItem('invoice_items_per_page', clamped.toString());
        } catch (e) {}
    };

    // Auto print or show chooser based on URL parameters
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const silent = params.get('silent') === '1';
        const urlTitle = params.get('title');
        const urlType = params.get('type');

        let initialTitle = '';
        if (urlTitle) {
            initialTitle = urlTitle;
        } else if (urlType === 'tax' || urlType === 'tax_invoice') {
            initialTitle = 'ใบกำกับภาษี';
        } else if (urlType === 'delivery' || urlType === 'do') {
            initialTitle = 'ใบส่งของ';
        } else if (urlType === 'receipt') {
            initialTitle = 'ใบเสร็จรับเงิน';
        }

        if (initialTitle) {
            setTitle(initialTitle);
            if (!silent) {
                const timer = setTimeout(() => window.print(), 500);
                return () => clearTimeout(timer);
            }
        } else {
            // No explicit title/type in URL -> show chooser modal to let user choose
            setShowChooser(true);
        }
    }, []);

    const handleSelectAndPrint = (selectedTitle: string) => {
        setTitle(selectedTitle);
        setShowChooser(false);
        setTimeout(() => window.print(), 300);
    };

    const headerLines = template?.headerText?.split('\n').filter(Boolean) || [];
    const companyName = headerLines[0] || 'บริษัท';
    const addressLines = headerLines.slice(1);

    // Payment info
    const payments = sale.payments as { method: string; amount: number; dueDate?: string }[] | null;
    const paidAtSale = payments?.filter(p => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0) ?? (sale.paymentMethod !== 'CREDIT' ? sale.totalAmount : 0);
    const totalPaid = paidAtSale + (sale.debtPaid || 0);
    const totalCredit = Math.max(0, sale.totalAmount - totalPaid);

    // Chunk items into separate pages
    const pages: (typeof sale.items)[] = [];
    if (sale.items.length === 0) {
        pages.push([]);
    } else {
        for (let i = 0; i < sale.items.length; i += itemsPerPage) {
            pages.push(sale.items.slice(i, i + itemsPerPage));
        }
    }
    const totalPages = pages.length;

    // Render Closing Summary and Signatures (shown on last page)
    const renderClosingBlock = () => (
        <div style={{ paddingTop: 4 }}>
            {/* Discount Summary */}
            {sale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <table style={{ borderCollapse: 'collapse', width: 280 }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', color: '#666' }}>ยอดรวมสินค้า</td>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', width: 90 }}>{formatCurrency(sale.totalAmount + sale.discount)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', color: '#dc2626' }}>ส่วนลด</td>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(sale.discount)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid #ccc' }}>
                                <td style={{ padding: '3px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>ยอดสุทธิ</td>
                                <td style={{ padding: '3px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(sale.totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Notes */}
            {sale.notes && (
                <div style={{ marginBottom: 5, padding: '5px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 1 }}>หมายเหตุ:</div>
                    <div style={{ fontSize: 11, color: '#333', whiteSpace: 'pre-wrap' }}>{sale.notes}</div>
                </div>
            )}

            {/* Special Note (A4 only) */}
            {template?.specialNote && (
                <div style={{ marginBottom: 5, padding: '6px 12px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fcd34d' }}>
                    <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 1 }}>โน๊ตพิเศษ:</div>
                    <div style={{ fontSize: 11, color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{template.specialNote}</div>
                </div>
            )}

            {/* VAT Summary */}
            {template?.showVat && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 5 }}>
                    <table style={{ borderCollapse: 'collapse', width: 280 }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', color: '#666' }}>มูลค่าก่อน VAT</td>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', width: 90 }}>{formatCurrency(sale.totalAmount / 1.07)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right', color: '#666' }}>VAT 7%</td>
                                <td style={{ padding: '2px 8px', fontSize: 11, textAlign: 'right' }}>{formatCurrency(sale.totalAmount - sale.totalAmount / 1.07)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px solid #ccc' }}>
                                <td style={{ padding: '3px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>รวมทั้งสิ้น</td>
                                <td style={{ padding: '3px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(sale.totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Credit info */}
            {totalCredit > 0 && sale.creditDueDate && (
                <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 5, fontWeight: 600 }}>
                    กำหนดชำระเงิน: {new Date(sale.creditDueDate).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </div>
            )}

            {/* QR Code */}
            {template?.showQr && template?.qrCodeUrl && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                    <div style={{ textAlign: 'center' }}>
                        <img src={template.qrCodeUrl} alt="QR Code" style={{ width: 80, height: 80, objectFit: 'contain' }} />
                        <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>สแกนเพื่อชำระเงิน</div>
                    </div>
                </div>
            )}

            {/* Footer Text */}
            {template?.footerText && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                    {template.footerText}
                </div>
            )}

            {/* Signature Lines */}
            <div style={{ paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                    {['ผู้รับของ', 'ผู้นำส่ง', 'ผู้รับเงิน', 'ผู้อนุมัติ'].map(label => (
                        <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 24 }}>{label}</div>
                            <div style={{ borderTop: '1px dashed #9ca3af', paddingTop: 2 }}>
                                <div style={{ fontSize: 9, color: '#9ca3af' }}>............................................</div>
                                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>วันที่ ........................................</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <style jsx global>{`
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    .no-print { display: none !important; }
                    .no-border-print {
                        border: none !important;
                        padding: 0 !important;
                        background: transparent !important;
                        width: auto !important;
                        text-align: right !important;
                    }
                    .invoice-page {
                        width: 210mm !important;
                        min-height: 294mm !important;
                        height: 294mm !important;
                        max-height: 295mm !important;
                        margin: 0 !important;
                        padding: 8mm 12mm 6mm 12mm !important;
                        box-shadow: none !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        box-sizing: border-box !important;
                        position: relative !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        overflow: hidden !important;
                    }
                    .invoice-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    * {
                        animation: none !important;
                        transition: none !important;
                    }
                }
                @media screen {
                    body {
                        background: #4b5563;
                        margin: 0;
                        padding: 20px 0 60px 0;
                    }
                    .invoice-page {
                        width: 210mm;
                        min-height: 297mm;
                        margin: 20px auto;
                        background: #fff;
                        padding: 10mm 12mm;
                        box-sizing: border-box;
                        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        position: relative;
                    }
                    .invoice-page:first-of-type {
                        margin-top: 85px;
                    }
                }
            `}</style>

            {/* Top Floating Toolbar (hidden in print) */}
            <div className="no-print" style={{
                position: 'fixed',
                top: 14,
                left: 16,
                right: 16,
                zIndex: 50,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                padding: '8px 16px',
                borderRadius: 14,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(229, 231, 235, 0.9)',
                maxWidth: '1000px',
                margin: '0 auto',
            }}>
                {/* Left: Quick Document Title Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                        📋 หัวบิล:
                    </span>
                    {[
                        { label: '📦 ใบส่งของ', value: 'ใบส่งของ', color: '#059669', bg: '#ecfdf5', border: '#10b981' },
                        { label: '📑 ใบกำกับภาษี', value: 'ใบกำกับภาษี', color: '#2563eb', bg: '#eff6ff', border: '#3b82f6' },
                        { label: '🧾 ใบเสร็จรับเงิน', value: 'ใบเสร็จรับเงิน', color: '#7c3aed', bg: '#f5f3ff', border: '#8b5cf6' },
                    ].map(opt => {
                        const active = title === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setTitle(opt.value)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: active ? 700 : 500,
                                    cursor: 'pointer',
                                    border: active ? `2px solid ${opt.border}` : '1px solid #d1d5db',
                                    background: active ? opt.bg : '#ffffff',
                                    color: active ? opt.color : '#4b5563',
                                    transition: 'all 0.15s ease',
                                    boxShadow: active ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>

                {/* Middle: Items per page selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', padding: '4px 10px', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>
                        📄 รายการ/หน้า:
                    </span>
                    <button
                        type="button"
                        onClick={() => handleItemsPerPageChange(itemsPerPage - 1)}
                        title="ลดจำนวนรายการต่อหน้า"
                        style={{
                            width: 24, height: 24, borderRadius: 5, border: '1px solid #d1d5db',
                            background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151'
                        }}
                    >
                        -
                    </button>
                    <input
                        type="number"
                        min={3}
                        max={30}
                        value={itemsPerPage}
                        onChange={e => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) handleItemsPerPageChange(val);
                        }}
                        style={{
                            width: 40,
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            padding: '2px 0',
                            color: '#111827',
                            outline: 'none',
                            background: '#fff',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => handleItemsPerPageChange(itemsPerPage + 1)}
                        title="เพิ่มจำนวนรายการต่อหน้า"
                        style={{
                            width: 24, height: 24, borderRadius: 5, border: '1px solid #d1d5db',
                            background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151'
                        }}
                    >
                        +
                    </button>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                        {[6, 8, 10, 12, 14].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => handleItemsPerPageChange(n)}
                                style={{
                                    padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: itemsPerPage === n ? 700 : 500,
                                    border: itemsPerPage === n ? '1.5px solid #059669' : '1px solid #d1d5db',
                                    background: itemsPerPage === n ? '#ecfdf5' : '#fff',
                                    color: itemsPerPage === n ? '#065f46' : '#6b7280',
                                    cursor: 'pointer',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            padding: '7px 18px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: '0 3px 8px rgba(16,185,129,0.3)',
                        }}
                    >
                        🖨️ พิมพ์ {title} ({totalPages} หน้า)
                    </button>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        style={{
                            padding: '7px 14px',
                            background: '#fff',
                            color: '#4b5563',
                            border: '1px solid #d1d5db',
                            borderRadius: 8,
                            fontWeight: 500,
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        ← กลับ
                    </button>
                </div>
            </div>

            {/* Modal Dialog to choose title if not pre-specified */}
            {showChooser && (
                <div className="no-print" style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 100,
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: 24,
                        padding: 28,
                        maxWidth: 460,
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                        border: '1px solid #e5e7eb',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>🖨️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                            เลือกหัวบิลที่ต้องการพิมพ์
                        </h2>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
                            บิลเลขที่ <strong style={{ color: '#111827' }}>#{sale.saleNumber}</strong> ({totalPages} หน้า) — เลือกเพื่อสั่งพิมพ์ทันที
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button
                                type="button"
                                onClick={() => handleSelectAndPrint('ใบส่งของ')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderRadius: 14,
                                    border: '2px solid #10b981',
                                    background: '#ecfdf5',
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.15)',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 22 }}>📦</span> พิมพ์ "ใบส่งของ"
                                </span>
                                <span style={{ fontSize: 11, background: '#10b981', color: '#fff', padding: '3px 9px', borderRadius: 9999, fontWeight: 600 }}>A4</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectAndPrint('ใบกำกับภาษี')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderRadius: 14,
                                    border: '2px solid #3b82f6',
                                    background: '#eff6ff',
                                    color: '#1e40af',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 22 }}>📑</span> พิมพ์ "ใบกำกับภาษี"
                                </span>
                                <span style={{ fontSize: 11, background: '#3b82f6', color: '#fff', padding: '3px 9px', borderRadius: 9999, fontWeight: 600 }}>A4</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectAndPrint('ใบเสร็จรับเงิน')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 20px',
                                    borderRadius: 14,
                                    border: '2px solid #8b5cf6',
                                    background: '#f5f3ff',
                                    color: '#5b21b6',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 6px rgba(139, 92, 246, 0.15)',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 22 }}>🧾</span> พิมพ์ "ใบเสร็จรับเงิน"
                                </span>
                                <span style={{ fontSize: 11, background: '#8b5cf6', color: '#fff', padding: '3px 9px', borderRadius: 9999, fontWeight: 600 }}>A4</span>
                            </button>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <button
                                type="button"
                                onClick={() => setShowChooser(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6b7280',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                ปิดหน้าต่างนี้ เพื่อดู/แก้ไขเอกสารก่อนพิมพ์
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Paginated A4 Pages */}
            {pages.map((pageItems, pageIdx) => {
                const isFirstPage = pageIdx === 0;
                const isLastPage = pageIdx === totalPages - 1;

                return (
                    <div
                        key={`page-${pageIdx}`}
                        className="invoice-page"
                        style={{
                            fontFamily: '"Sarabun", "Inter", sans-serif',
                            fontSize: 12,
                            color: '#222',
                            lineHeight: 1.5,
                        }}
                    >
                        {/* Upper Section: Header + Items Table */}
                        <div style={{ flex: 1 }}>
                            {/* ================= PAGE 1 HEADER ================= */}
                            {isFirstPage ? (
                                <>
                                    {/* Top Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                        {/* Left: Logo + Company */}
                                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                                            {template?.showLogo && template?.logoUrl && (
                                                <img src={template.logoUrl} alt="logo" style={{ height: 58, objectFit: 'contain' }} />
                                            )}
                                            <div>
                                                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{companyName}</div>
                                                {addressLines.map((line, i) => (
                                                    <div key={i} style={{ fontSize: 11, color: '#555' }}>{line}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Right: Bill No, Title & Page */}
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 12, color: '#888' }}># {sale.saleNumber}</div>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                                style={{
                                                    fontSize: 17,
                                                    fontWeight: 700,
                                                    marginTop: 2,
                                                    textAlign: 'right',
                                                    border: '1px dashed #ccc',
                                                    padding: '1px 6px',
                                                    borderRadius: 4,
                                                    width: '200px',
                                                    outline: 'none',
                                                }}
                                                className="no-border-print"
                                            />
                                            <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 700, marginTop: 2 }}>
                                                หน้า {pageIdx + 1}/{totalPages}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Box */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, border: '1px solid #ccc' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: '4px 10px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 11, color: '#666', width: '33%' }}>
                                                    วันที่ออก<br /><strong style={{ color: '#222' }}>{formatDate(sale.createdAt)}</strong>
                                                </td>
                                                <td style={{ padding: '4px 10px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 11, color: '#666', width: '33%' }}>
                                                    รวมเงินทั้งสิ้น<br /><strong style={{ color: '#222', fontSize: 15 }}>{formatCurrency(sale.totalAmount)}</strong>
                                                </td>
                                                <td rowSpan={2} style={{ padding: '4px 10px', fontSize: 11, color: '#666', textAlign: 'center', verticalAlign: 'middle', width: '33%' }}>
                                                    {numberToThaiText(sale.totalAmount)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '4px 10px', borderRight: '1px solid #ccc', fontSize: 11, color: '#666' }}>
                                                    จ่ายเงินแล้ว<br /><strong style={{ color: '#222' }}>{formatCurrency(totalPaid)}</strong>
                                                </td>
                                                <td style={{ padding: '4px 10px', borderRight: '1px solid #ccc', fontSize: 11, color: '#666' }}>
                                                    ค้างชำระ<br /><strong style={{ color: totalCredit > 0 ? '#dc2626' : '#222' }}>{formatCurrency(totalCredit)}</strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Customer + Staff info */}
                                    {(template?.showCustomer || template?.showStaff || !template) && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 8, alignItems: 'flex-start' }}>
                                            {(template?.showCustomer || !template) && sale.customer && (
                                                <div>
                                                    <div>ลูกค้า: <strong style={{ color: '#222' }}>{sale.customer.name}</strong> {sale.customer.phone && `(${sale.customer.phone})`}</div>
                                                    {sale.customer.address && <div style={{ marginTop: 1 }}>ที่อยู่: {sale.customer.address}</div>}
                                                    {sale.customer.taxId && <div style={{ marginTop: 1 }}>เลขประจำตัวผู้เสียภาษี: {sale.customer.taxId}</div>}
                                                </div>
                                            )}
                                            {(template?.showStaff || !template) && (
                                                <div style={{ textAlign: 'right' }}>พนักงาน: <strong style={{ color: '#222' }}>{sale.createdBy.name}</strong></div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* ================= PAGE 2+ REPEATED HEADER ================= */
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, borderBottom: '2px solid #111827', paddingBottom: 6 }}>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        {template?.showLogo && template?.logoUrl && (
                                            <img src={template.logoUrl} alt="logo" style={{ height: 38, objectFit: 'contain' }} />
                                        )}
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{companyName}</div>
                                            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>
                                                ลูกค้า: <strong style={{ color: '#111827' }}>{sale.customer?.name || 'ลูกค้าทั่วไป'}</strong>
                                                {sale.customer?.phone && ` (${sale.customer.phone})`} | วันที่: {formatDate(sale.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}># {sale.saleNumber}</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 1 }}>{title}</div>
                                        <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 700, marginTop: 1 }}>
                                            หน้า {pageIdx + 1}/{totalPages}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items Table for this page */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
                                <thead>
                                    <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', background: '#f9fafb' }}>
                                        <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 65 }}>บาร์โค้ด</th>
                                        <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 11, fontWeight: 600 }}>สินค้า</th>
                                        <th style={{ textAlign: 'center', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 55 }}>จำนวน</th>
                                        <th style={{ textAlign: 'center', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 65 }}>หน่วยนับ</th>
                                        <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 85 }}>ราคาขาย</th>
                                        <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 75 }}>ส่วนลด</th>
                                        <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 11, fontWeight: 600, width: 95 }}>จำนวนเงิน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '4px 8px', fontSize: 11 }}>{item.product.code}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11 }}>{item.product.name}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11, textAlign: 'center' }}>{item.quantity}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11, textAlign: 'center' }}>{item.unitName || item.product.unit}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11, textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11, textAlign: 'right' }}>{formatCurrency(item.discount || 0)}</td>
                                            <td style={{ padding: '4px 8px', fontSize: 11, textAlign: 'right' }}>{formatCurrency(item.totalPrice)}</td>
                                        </tr>
                                    ))}
                                    {/* Empty rows to fill at least 5 rows if only 1 page */}
                                    {totalPages === 1 && Array.from({ length: Math.max(0, 5 - pageItems.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '4px 8px', fontSize: 11 }}>&nbsp;</td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                            <td style={{ padding: '4px 8px' }}></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Section: Closing block on last page + Page footer */}
                        <div style={{ marginTop: 'auto' }}>
                            {isLastPage && renderClosingBlock()}

                            {/* Page Footer Counter */}
                            <div style={{
                                textAlign: 'center',
                                fontSize: 10,
                                color: '#9ca3af',
                                paddingTop: 4,
                            }}>
                                - หน้า {pageIdx + 1}/{totalPages} -
                            </div>
                        </div>
                    </div>
                );
            })}
        </>
    );
}
