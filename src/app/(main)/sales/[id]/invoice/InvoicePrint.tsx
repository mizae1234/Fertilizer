'use client';

import { useEffect } from 'react';

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
    // Auto print
    useEffect(() => {
        // small delay to let styles load
        const timer = setTimeout(() => window.print(), 500);
        return () => clearTimeout(timer);
    }, []);

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
                }
                @media screen {
                    body { background: #666; }
                }
            `}</style>

            {/* Print button (hidden in print) */}
            <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()}
                    style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #10b981, #14b8a6)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                    🖨️ พิมพ์ / บันทึก PDF
                </button>
                <button onClick={() => window.history.back()}
                    style={{ padding: '10px 20px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                    ← กลับ
                </button>
            </div>

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
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>ใบส่งของ / ใบเสร็จรับเงิน</div>
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
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{item.product.unit}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(0)}</td>
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

                {/* Credit info */}
                {totalCredit > 0 && sale.creditDueDate && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                        กำหนดชำระเงิน: {new Date(sale.creditDueDate).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })}
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
                        {['ผู้รับของ', 'ผู้นำส่ง', 'ผู้รับเงิน', 'ผู้รับมอบอำนาจ'].map(label => (
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
