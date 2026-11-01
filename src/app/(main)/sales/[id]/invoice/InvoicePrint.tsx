'use client';

import { useEffect, useState } from 'react';

interface SaleData {
    id: string;
    saleNumber: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    creditDueDate: string | null;
    payments: { method: string; amount: number; dueDate?: string }[] | null;
    notes: string | null;
    createdAt: string;
    customer: { name: string; phone: string } | null;
    createdBy: { name: string };
    items: {
        id: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        discount: number;
        unitName: string | null;
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
    showBillNo: boolean;
    showVat: boolean;
    showQr: boolean;
    qrCodeUrl: string | null;
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
    const totalPaid = payments?.filter(p => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0) ?? (sale.paymentMethod !== 'CREDIT' ? sale.totalAmount : 0);
    const totalCredit = sale.totalAmount - totalPaid;

    return (
        <>
            <style jsx global>{`
                @media print {
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4; margin: 15mm; }
                    .no-print { display: none !important; }
                    .no-border-print {
                        border: none !important;
                        padding: 0 !important;
                        background: transparent !important;
                        width: auto !important;
                        text-align: right !important;
                    }
                }
                @media screen {
                    body { background: #666; }
                }
            `}</style>

            {/* Top Floating Toolbar (hidden in print) */}
            <div className="no-print" style={{
                position: 'fixed',
                top: 16,
                left: 16,
                right: 16,
                zIndex: 50,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                background: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(8px)',
                padding: '10px 18px',
                borderRadius: 16,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(229, 231, 235, 0.9)',
                maxWidth: '960px',
                margin: '0 auto',
            }}>
                {/* Left: Quick Document Title Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
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
                                    padding: '6px 14px',
                                    borderRadius: 10,
                                    fontSize: 13,
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

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 4px 10px rgba(16,185,129,0.3)',
                        }}
                    >
                        🖨️ พิมพ์ {title}
                    </button>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        style={{
                            padding: '8px 16px',
                            background: '#fff',
                            color: '#4b5563',
                            border: '1px solid #d1d5db',
                            borderRadius: 10,
                            fontWeight: 500,
                            fontSize: 13,
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
                            บิลเลขที่ <strong style={{ color: '#111827' }}>#{sale.saleNumber}</strong> — เลือกเพื่อสั่งพิมพ์ทันที
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

            {/* A4 Page */}
            <div style={{
                width: '210mm', minHeight: '297mm', margin: '20px auto', background: '#fff',
                padding: '15mm', fontFamily: '"Sarabun", "Inter", sans-serif', fontSize: 13,
                color: '#222', lineHeight: 1.6, position: 'relative',
                boxShadow: '0 0 20px rgba(0,0,0,0.3)',
            }}>

                {/* Top Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    {/* Left: Logo + Company */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
                        {template?.showLogo && template?.logoUrl && (
                            <img src={template.logoUrl} alt="logo" style={{ height: 70, objectFit: 'contain' }} />
                        )}
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{companyName}</div>
                            {addressLines.map((line, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#555' }}>{line}</div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Bill No */}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#888' }}># {sale.saleNumber}</div>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                marginTop: 4,
                                textAlign: 'right',
                                border: '1px dashed #ccc',
                                padding: '2px 8px',
                                borderRadius: 4,
                                width: '220px',
                                outline: 'none',
                            }}
                            className="no-border-print"
                        />
                    </div>
                </div>

                {/* Info Box */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1px solid #ccc' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 12, color: '#666', width: '33%' }}>
                                วันที่ออก<br /><strong style={{ color: '#222' }}>{formatDate(sale.createdAt)}</strong>
                            </td>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 12, color: '#666', width: '33%' }}>
                                รวมเงินทั้งสิ้น<br /><strong style={{ color: '#222', fontSize: 16 }}>{formatCurrency(sale.totalAmount)}</strong>
                            </td>
                            <td rowSpan={2} style={{ padding: '6px 12px', fontSize: 11, color: '#666', textAlign: 'center', verticalAlign: 'middle', width: '33%' }}>
                                {numberToThaiText(sale.totalAmount)}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', fontSize: 12, color: '#666' }}>
                                จ่ายเงินแล้ว<br /><strong style={{ color: '#222' }}>{formatCurrency(totalPaid)}</strong>
                            </td>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', fontSize: 12, color: '#666' }}>
                                ค้างชำระ<br /><strong style={{ color: totalCredit > 0 ? '#dc2626' : '#222' }}>{formatCurrency(totalCredit)}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Customer + Staff info */}
                {(template?.showCustomer || template?.showStaff || !template) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 8 }}>
                        {(template?.showCustomer || !template) && sale.customer && (
                            <div>ลูกค้า: <strong style={{ color: '#222' }}>{sale.customer.name}</strong> {sale.customer.phone && `(${sale.customer.phone})`}</div>
                        )}
                        {(template?.showStaff || !template) && (
                            <div>พนักงาน: <strong style={{ color: '#222' }}>{sale.createdBy.name}</strong></div>
                        )}
                    </div>
                )}

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                    <thead>
                        <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                            <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 60 }}>บาร์โค้ด</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 12, fontWeight: 600 }}>สินค้า</th>
                            <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 60 }}>จำนวน</th>
                            <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 70 }}>หน่วยนับ</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 90 }}>ราคาขาย</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 90 }}>ส่วนลด</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 100 }}>จำนวนเงิน</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 8px', fontSize: 12 }}>{item.product.code}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12 }}>{item.product.name}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{item.unitName || item.product.unit}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.discount || 0)}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.totalPrice)}</td>
                            </tr>
                        ))}
                        {/* Empty rows to fill at least 8 rows total */}
                        {Array.from({ length: Math.max(0, 8 - sale.items.length) }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td style={{ padding: '8px 8px', fontSize: 12 }}>&nbsp;</td>
                                <td style={{ padding: '8px 8px' }}></td>
                                <td style={{ padding: '8px 8px' }}></td>
                                <td style={{ padding: '8px 8px' }}></td>
                                <td style={{ padding: '8px 8px' }}></td>
                                <td style={{ padding: '8px 8px' }}></td>
                                <td style={{ padding: '8px 8px' }}></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Notes */}
                {sale.notes && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>หมายเหตุ:</div>
                        <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap' }}>{sale.notes}</div>
                    </div>
                )}

                {/* VAT Summary */}
                {template?.showVat && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <table style={{ borderCollapse: 'collapse', width: 300 }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#666' }}>มูลค่าก่อน VAT</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', width: 100 }}>{formatCurrency(sale.totalAmount / 1.07)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#666' }}>VAT 7%</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(sale.totalAmount - sale.totalAmount / 1.07)}</td>
                                </tr>
                                <tr style={{ borderTop: '1px solid #ccc' }}>
                                    <td style={{ padding: '4px 8px', fontSize: 13, textAlign: 'right', fontWeight: 700 }}>รวมทั้งสิ้น</td>
                                    <td style={{ padding: '4px 8px', fontSize: 13, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(sale.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Outstanding Balance Summary */}
                {totalCredit > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #fecaca', borderRadius: 6 }}>
                            <tbody>
                                <tr style={{ background: '#fef2f2' }}>
                                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#666', width: '50%' }}>
                                        รวมเงินทั้งสิ้น
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                                        {formatCurrency(sale.totalAmount)}
                                    </td>
                                </tr>
                                <tr style={{ background: '#fef2f2' }}>
                                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#666' }}>
                                        ชำระแล้ว
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#16a34a' }}>
                                        {formatCurrency(totalPaid)}
                                    </td>
                                </tr>
                                <tr style={{ background: '#fee2e2', borderTop: '1px solid #fecaca' }}>
                                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                                        ยอดค้างชำระ
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 16, fontWeight: 700, textAlign: 'right', color: '#dc2626' }}>
                                        {formatCurrency(totalCredit)}
                                    </td>
                                </tr>
                                {sale.creditDueDate && (
                                    <tr style={{ background: '#fef2f2' }}>
                                        <td colSpan={2} style={{ padding: '6px 12px', fontSize: 11, color: '#dc2626', textAlign: 'center' }}>
                                            กำหนดชำระเงิน: {new Date(sale.creditDueDate).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* QR Code */}
                {template?.showQr && template?.qrCodeUrl && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                        <div style={{ textAlign: 'center' }}>
                            <img src={template.qrCodeUrl} alt="QR Code" style={{ width: 120, height: 120, objectFit: 'contain' }} />
                            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>สแกนเพื่อชำระเงิน</div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {template?.footerText && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
                        {template.footerText}
                    </div>
                )}

                {/* Signature Lines */}
                <div style={{ position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                        {['ผู้รับของ', 'ผู้นำส่ง', 'ผู้รับเงิน', 'ผู้อนุมัติ'].map(label => (
                            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 40 }}>{label}</div>
                                <div style={{ borderTop: '1px dashed #999', paddingTop: 6 }}>
                                    <div style={{ fontSize: 10, color: '#aaa' }}>............................................</div>
                                    <div style={{ fontSize: 10, color: '#aaa' }}>วันที่ ........................................</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
