'use client';

import { useEffect } from 'react';

interface SaleItem {
    product: { name: string; code: string; unit: string };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

interface Sale {
    id: string;
    saleNumber: string;
    customer: { name: string; phone: string } | null;
    createdBy: { name: string } | null;
    createdAt: string;
    totalAmount: number;
    discount: number;
    payments: { method: string; amount: number }[];
    notes: string | null;
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
}

type Template = TemplateData | null;

function formatCurrency(n: number) {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        case 'CREDIT': return 'เครดิต';
        default: return m;
    }
}

export default function ReceiptPrint({ sale, template, cashReceived }: { sale: Sale; template: Template; cashReceived?: number }) {
    // Auto print when loaded
    useEffect(() => {
        const timer = setTimeout(() => window.print(), 300);
        return () => clearTimeout(timer);
    }, []);

    const shopName = template?.shopName || 'Fertilizer POS';
    const totalPaid = (sale.payments || [])
        .filter(p => p.method !== 'CREDIT')
        .reduce((s, p) => s + p.amount, 0);
    const change = totalPaid - sale.totalAmount;

    return (
        <>
            <style jsx global>{`
                @page {
                    size: 80mm auto;
                    margin: 0;
                }

                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                }

                body {
                    font-family: 'Sarabun', 'Tahoma', sans-serif;
                    font-size: 14px;
                    line-height: 1.4;
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

            <div style={{ width: '72mm', margin: '0 auto', padding: '4mm 0' }}>
                {/* Logo */}
                {template?.showLogo && template?.logoUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.logoUrl} alt="logo" style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
                    </div>
                )}

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    {template?.headerText ? (
                        template.headerText.split('\n').map((line, i) => (
                            <div key={i} style={{ fontSize: i === 0 ? '18px' : '13px', fontWeight: i === 0 ? 'bold' : 'normal' }}>{line}</div>
                        ))
                    ) : (
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{shopName}</div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

                {/* Bill Info */}
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                    {(template?.showBillNo !== false) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>บิลเลขที่: {sale.saleNumber}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{formatDate(sale.createdAt)}</span>
                        {(template?.showStaff !== false) && <span>พนง: {sale.createdBy?.name || '-'}</span>}
                    </div>
                    {(template?.showCustomer !== false) && sale.customer && (
                        <div>
                            <div>ลูกค้า: {sale.customer.name}</div>
                            {sale.customer.phone && <div>โทร: {sale.customer.phone}</div>}
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

                {/* Items */}
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', paddingBottom: '2px' }}>สินค้า</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '35px' }}>จำนวน</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '50px' }}>ราคา</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '55px' }}>รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, i) => (
                            <tr key={i}>
                                <td style={{ paddingTop: '2px' }}>
                                    <div style={{ fontSize: '13px' }}>{item.product.name}</div>
                                </td>
                                <td style={{ textAlign: 'right', paddingTop: '2px' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', paddingTop: '2px' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ textAlign: 'right', paddingTop: '2px' }}>{formatCurrency(item.totalPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                {/* Totals */}
                <div style={{ fontSize: '14px' }}>
                    {sale.discount > 0 && (<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>ยอดรวมสินค้า</span>
                            <span>{formatCurrency(sale.totalAmount + sale.discount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>ส่วนลด</span>
                            <span>-{formatCurrency(sale.discount)}</span>
                        </div>
                    </>)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                        <span>รวมทั้งสิ้น</span>
                        <span>{formatCurrency(sale.totalAmount)}</span>
                    </div>

                    {/* Payment breakdown */}
                    {(sale.payments || []).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>{methodLabel(p.method)}</span>
                            <span>{formatCurrency(p.amount)}</span>
                        </div>
                    ))}

                    {cashReceived && cashReceived > 0 ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '2px' }}>
                                <span>รับเงินมา</span>
                                <span>{formatCurrency(cashReceived)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                                <span>เงินทอน</span>
                                <span>{formatCurrency(cashReceived - sale.totalAmount)}</span>
                            </div>
                        </>
                    ) : change > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                            <span>เงินทอน</span>
                            <span>{formatCurrency(change)}</span>
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                {/* QR Code */}
                {template?.showQr && template?.qrCodeUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.qrCodeUrl} alt="QR Code" style={{ width: '100px', height: '100px', objectFit: 'contain', margin: '0 auto' }} />
                    </div>
                )}

                {/* Notes */}
                {sale.notes && (
                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>
                        หมายเหตุ: {sale.notes}
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {template?.footer || 'ขอบคุณที่ใช้บริการ'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#000', marginTop: '4px' }}>
                    {sale.saleNumber}
                </div>
            </div>
        </>
    );
}
