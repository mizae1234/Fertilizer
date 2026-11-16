'use client';

import { useEffect } from 'react';

interface SaleItem {
    product: { name: string; code: string; unit: string };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discount?: number;
    unitName?: string;
}

interface Sale {
    id: string;
    saleNumber: string;
    customer: { name: string; phone: string; address?: string | null; taxId?: string | null } | null;
    createdBy: { name: string } | null;
    createdAt: string;
    totalAmount: number;
    discount: number;
    payments: { method: string; amount: number; chequeNo?: string }[];
    notes: string | null;
    debtPaid: number;
    items: SaleItem[];
}

interface TemplateData {
    shopName: string;
    headerText: string | null;
    footer: string | null;
    showLogo: boolean;
    logoUrl: string | null;
    showQr: boolean;
    qrCodeUrl: string | null;
    showBillNo: boolean;
    showStaff: boolean;
    showCustomer: boolean;
    paperSize?: string;
}

type Template = TemplateData | null;

function formatCurrency(n: number) {
    const rounded = Math.round(n * 100) / 100;
    return rounded.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function methodLabel(m: string) {
    switch (m) {
        case 'CASH': return 'เงินสด';
        case 'TRANSFER': return 'โอนเงิน';
        case 'CHEQUE': return 'เช็ค';
        case 'CREDIT': return 'ค้างชำระ';
        default: return m;
    }
}

export default function ReceiptPrint({ sale, template, cashReceived }: { sale: Sale; template: Template; cashReceived?: number }) {
    // Auto print when loaded
    useEffect(() => {
        const timer = setTimeout(() => window.print(), 300);
        return () => clearTimeout(timer);
    }, []);

    const shopName = template?.shopName || 'ร้านค้า';
    const is58mm = template?.paperSize === '58mm';
    // 80mm thermal paper has ~72mm printable width (576 dots at 203 DPI)
    // 58mm thermal paper has ~48mm printable width (384 dots at 203 DPI)
    const paperWidth = is58mm ? '58mm' : '80mm';
    const contentWidth = is58mm ? '48mm' : '72mm';
    const contentPadding = is58mm ? '2.5mm 2.5mm 4mm 2.5mm' : '3mm 4mm 5mm 4mm';
    const baseFontSize = is58mm ? '11.5px' : '13px';
    const smallFontSize = is58mm ? '10.5px' : '12px';
    const titleFontSize = is58mm ? '14px' : '16px';
    const numColWidth = is58mm ? '16px' : '20px';

    const paidAtSale = (sale.payments || [])
        .filter(p => p.method !== 'CREDIT')
        .reduce((s, p) => s + p.amount, 0);
    const totalPaid = paidAtSale + (sale.debtPaid || 0);
    const cashTotal = (sale.payments || [])
        .filter(p => p.method === 'CASH')
        .reduce((s, p) => s + p.amount, 0);
    const change = Math.round((totalPaid - sale.totalAmount) * 100) / 100;

    return (
        <>
            <style jsx global>{`
                @page {
                    size: ${paperWidth} auto;
                    margin: 0 !important;
                }

                @media print {
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                    }
                    html, body {
                        width: 100% !important;
                        max-width: ${paperWidth} !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        background: #fff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .receipt-container {
                        width: ${contentWidth} !important;
                        max-width: ${contentWidth} !important;
                        margin: 0 auto !important;
                        padding: ${contentPadding} !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }

                body {
                    font-family: 'Sarabun', 'Tahoma', sans-serif;
                    font-size: ${baseFontSize};
                    line-height: 1.38;
                    color: #000;
                    background: #fff;
                }
            `}</style>

            {/* Print / Close buttons (hidden when printing) */}
            <div className="no-print" style={{ textAlign: 'center', padding: '10px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginRight: '8px' }}>
                    🖨️ พิมพ์
                </button>
                <button onClick={() => window.close()} style={{ padding: '8px 20px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    ✕ ปิด
                </button>
            </div>

            <div className="receipt-container" style={{ width: contentWidth, maxWidth: contentWidth, margin: '0 auto', padding: contentPadding, boxSizing: 'border-box' }}>
                {/* Logo */}
                {template?.showLogo && template?.logoUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.logoUrl} alt="logo" style={{ maxHeight: '96px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
                    </div>
                )}

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                    {template?.headerText ? (
                        template.headerText.split('\n').map((line, i) => (
                            <div key={i} style={{ fontSize: i === 0 ? titleFontSize : smallFontSize, fontWeight: i === 0 ? 'bold' : 'normal', lineHeight: 1.35 }}>{line}</div>
                        ))
                    ) : (
                        <div style={{ fontSize: titleFontSize, fontWeight: 'bold' }}>{shopName}</div>
                    )}
                </div>

                {/* Bill Info */}
                <div style={{ fontSize: smallFontSize, marginTop: '6px', marginBottom: '4px' }}>
                    {(template?.showBillNo !== false) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>บิลเลขที่: {sale.saleNumber}</span>
                            {(template?.showStaff !== false) && <span>พนง: {sale.createdBy?.name || '-'}</span>}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{formatDate(sale.createdAt)}</span>
                        {(template?.showBillNo === false) && (template?.showStaff !== false) && <span>พนง: {sale.createdBy?.name || '-'}</span>}
                    </div>
                    {(template?.showCustomer !== false) && sale.customer && (
                        <div style={{ marginTop: '2px' }}>
                            <div>ลูกค้า: {sale.customer.name}</div>
                            {sale.customer.phone && <div>โทร: {sale.customer.phone}</div>}
                            {sale.customer.address && <div>ที่อยู่: {sale.customer.address}</div>}
                            {sale.customer.taxId && <div>เลขผู้เสียภาษี: {sale.customer.taxId}</div>}
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px solid #000', margin: '5px 0' }} />

                {/* Numbered 2-line Items List */}
                <div style={{ fontSize: baseFontSize }}>
                    {sale.items.map((item, i) => (
                        <div key={i} style={{ marginBottom: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span style={{ minWidth: numColWidth, display: 'inline-block' }}>{i + 1}</span>
                                <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.product.name}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingLeft: numColWidth }}>
                                <span>
                                    {item.quantity} {item.unitName || item.product.unit} x{formatCurrency(item.unitPrice)}
                                    {item.discount && item.discount > 0 ? ` (-${formatCurrency(item.discount)})` : ''}
                                </span>
                                <span>{formatCurrency(item.totalPrice)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: '1px solid #000', margin: '5px 0' }} />

                {/* Totals */}
                <div style={{ fontSize: baseFontSize }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>รวมเงิน</span>
                        <span style={{ fontWeight: 'bold' }}>{formatCurrency(sale.totalAmount + sale.discount)}</span>
                    </div>
                    {sale.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>ส่วนลด</span>
                            <span>-{formatCurrency(sale.discount)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: titleFontSize, marginTop: '2px', marginBottom: '2px' }}>
                        <span>รวมทั้งสิ้น</span>
                        <span>{formatCurrency(sale.totalAmount)}</span>
                    </div>

                    {/* Payment breakdown */}
                    {(sale.payments || []).map((p, i) => {
                        if (p.method === 'CREDIT') {
                            const remaining = Math.max(0, p.amount - (sale.debtPaid || 0));
                            return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: smallFontSize }}>
                                    <span>{remaining > 0 ? 'ค้างชำระ' : 'ชำระแล้ว (เครดิต)'}</span>
                                    <span>{formatCurrency(remaining)}</span>
                                </div>
                            );
                        }
                        return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: smallFontSize }}>
                                <span>{methodLabel(p.method)}{p.chequeNo ? ` (${p.chequeNo})` : ''}</span>
                                <span>{formatCurrency(p.amount)}</span>
                            </div>
                        );
                    })}

                    {cashReceived && cashReceived > 0 ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: smallFontSize, marginTop: '1px' }}>
                                <span>รับเงินสด</span>
                                <span>{formatCurrency(cashReceived)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: smallFontSize, fontWeight: 'bold', marginTop: '1px' }}>
                                <span>เงินทอน</span>
                                <span>{formatCurrency(cashReceived - cashTotal)}</span>
                            </div>
                        </>
                    ) : change > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: smallFontSize, fontWeight: 'bold', marginTop: '1px' }}>
                            <span>เงินทอน</span>
                            <span>{formatCurrency(change)}</span>
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                {/* QR Code */}
                {template?.showQr && template?.qrCodeUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.qrCodeUrl} alt="QR Code" style={{ width: '90px', height: '90px', objectFit: 'contain', margin: '0 auto' }} />
                    </div>
                )}

                {/* Notes */}
                {sale.notes && (
                    <div style={{ fontSize: smallFontSize, marginBottom: '4px' }}>
                        หมายเหตุ: {sale.notes}
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: smallFontSize, marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                    {template?.footer || 'ขอบคุณที่ใช้บริการ'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#000', marginTop: '3px' }}>
                    {sale.saleNumber}
                </div>
            </div>
        </>
    );
}
