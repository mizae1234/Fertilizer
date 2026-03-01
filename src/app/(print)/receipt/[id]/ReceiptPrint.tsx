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
    address: string | null;
    phone: string | null;
    taxId: string | null;
    footer: string | null;
    logoUrl: string | null;
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

export default function ReceiptPrint({ sale, template }: { sale: Sale; template: Template }) {
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
                    font-size: 12px;
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
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{shopName}</div>
                    {template?.address && <div style={{ fontSize: '10px' }}>{template.address}</div>}
                    {template?.phone && <div style={{ fontSize: '10px' }}>โทร: {template.phone}</div>}
                    {template?.taxId && <div style={{ fontSize: '10px' }}>เลขผู้เสียภาษี: {template.taxId}</div>}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

                {/* Bill Info */}
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>บิลเลขที่: {sale.saleNumber}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{formatDate(sale.createdAt)}</span>
                        <span>พนง: {sale.createdBy?.name || '-'}</span>
                    </div>
                    {sale.customer && (
                        <div>
                            <div>ลูกค้า: {sale.customer.name}</div>
                            {sale.customer.phone && <div>โทร: {sale.customer.phone}</div>}
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

                {/* Items */}
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', paddingBottom: '2px' }}>สินค้า</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '35px' }}>จำนวน</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '45px' }}>ราคา</th>
                            <th style={{ textAlign: 'right', paddingBottom: '2px', width: '50px' }}>รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, i) => (
                            <tr key={i}>
                                <td style={{ paddingTop: '2px' }}>
                                    <div style={{ fontSize: '11px' }}>{item.product.name}</div>
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
                <div style={{ fontSize: '12px' }}>
                    {sale.discount > 0 && (<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span>ยอดรวมสินค้า</span>
                            <span>{formatCurrency(sale.totalAmount + sale.discount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#dc2626' }}>
                            <span>ส่วนลด</span>
                            <span>-{formatCurrency(sale.discount)}</span>
                        </div>
                    </>)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                        <span>รวมทั้งสิ้น</span>
                        <span>{formatCurrency(sale.totalAmount)}</span>
                    </div>

                    {/* Payment breakdown */}
                    {(sale.payments || []).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span>{methodLabel(p.method)}</span>
                            <span>{formatCurrency(p.amount)}</span>
                        </div>
                    ))}

                    {change > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                            <span>เงินทอน</span>
                            <span>{formatCurrency(change)}</span>
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                {/* Notes */}
                {sale.notes && (
                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>
                        หมายเหตุ: {sale.notes}
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
                    {template?.footer || 'ขอบคุณที่ใช้บริการ'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '4px' }}>
                    {sale.saleNumber}
                </div>
            </div>
        </>
    );
}
