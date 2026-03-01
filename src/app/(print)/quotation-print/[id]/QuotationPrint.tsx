'use client';

import { useEffect } from 'react';

interface QuotationData {
    id: string;
    quotationNumber: string;
    status: string;
    totalAmount: number;
    discount: number;
    customerName: string | null;
    validUntil: string | null;
    notes: string | null;
    createdAt: string;
    customer: { name: string; phone: string; address: string | null } | null;
    createdBy: { name: string };
    items: {
        id: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        unitName: string | null;
        product: { name: string; code: string; unit: string };
    }[];
}

interface TemplateData {
    id: string;
    showLogo: boolean;
    logoUrl: string | null;
    headerText: string;
    footerText: string;
}

interface ShopInfoData {
    name: string;
    taxId: string;
    address: string;
    notes: string;
}

function formatCurrency(n: number) {
    return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

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
    if (intPart >= 1000000) { text += groupToText(Math.floor(intPart / 1000000)) + 'ล้าน'; text += groupToText(intPart % 1000000); }
    else { text += groupToText(intPart); }
    text += 'บาท';
    if (decPart > 0) { text += groupToText(decPart) + 'สตางค์'; } else { text += 'ถ้วน'; }
    return '(' + text + ')';
}

export default function QuotationPrint({ quotation, template, shopInfo }: { quotation: QuotationData; template: TemplateData | null; shopInfo: ShopInfoData | null }) {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('silent') === '1') return;
        const timer = setTimeout(() => window.print(), 500);
        return () => clearTimeout(timer);
    }, []);

    const headerLines = template?.headerText?.split('\n').filter(Boolean) || [];
    const companyName = shopInfo?.name || headerLines[0] || 'บริษัท';
    const addressLines = shopInfo?.address ? shopInfo.address.split('\n') : headerLines.slice(1);
    const custName = quotation.customer?.name || quotation.customerName || '-';
    const subtotal = quotation.totalAmount + quotation.discount;

    return (
        <>
            <style jsx global>{`
                @media print {
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4; margin: 0; }
                    .no-print { display: none !important; }
                    .qt-page { width: 100% !important; min-height: 100% !important; margin: 0 !important; box-shadow: none !important; padding: 15mm !important; }
                    * { animation: none !important; transition: none !important; }
                }
                @media screen { body { background: #666; } }
            `}</style>

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

            <div className="qt-page" style={{
                width: '210mm', minHeight: '297mm', margin: '20px auto', background: '#fff',
                padding: '15mm', fontFamily: '"Sarabun", "Inter", sans-serif', fontSize: 13,
                color: '#222', lineHeight: 1.6,
                boxShadow: '0 0 20px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column' as const,
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
                        {template?.showLogo && template?.logoUrl && (
                            <img src={template.logoUrl} alt="logo" style={{ height: 70, objectFit: 'contain' }} />
                        )}
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{companyName}</div>
                            {addressLines.map((line, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#555' }}>{line}</div>
                            ))}
                            {shopInfo?.taxId && <div style={{ fontSize: 11, color: '#888' }}>เลขที่ผู้เสียภาษี: {shopInfo.taxId}</div>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#888' }}># {quotation.quotationNumber}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#10b981' }}>ใบเสนอราคา</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>QUOTATION</div>
                    </div>
                </div>

                {/* Info Box */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1px solid #ccc' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 12, color: '#666', width: '33%' }}>
                                วันที่ออก<br /><strong style={{ color: '#222' }}>{formatDate(quotation.createdAt)}</strong>
                            </td>
                            <td style={{ padding: '6px 12px', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc', fontSize: 12, color: '#666', width: '33%' }}>
                                หมดอายุ<br /><strong style={{ color: '#222' }}>{quotation.validUntil ? formatDate(quotation.validUntil) : '-'}</strong>
                            </td>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid #ccc', fontSize: 12, color: '#666', width: '33%' }}>
                                รวมเงินทั้งสิ้น<br /><strong style={{ color: '#222', fontSize: 16 }}>{formatCurrency(quotation.totalAmount)}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} style={{ padding: '6px 12px', borderRight: '1px solid #ccc', fontSize: 12, color: '#666' }}>
                                ลูกค้า: <strong style={{ color: '#222' }}>{custName}</strong>
                                {quotation.customer?.phone && ` (${quotation.customer.phone})`}
                                {quotation.customer?.address && <><br /><span style={{ fontSize: 11 }}>{quotation.customer.address}</span></>}
                            </td>
                            <td style={{ padding: '6px 12px', fontSize: 11, color: '#666', textAlign: 'center', verticalAlign: 'middle' }}>
                                {numberToThaiText(quotation.totalAmount)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Items */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                    <thead>
                        <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                            <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 40 }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 80 }}>รหัส</th>
                            <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 12, fontWeight: 600 }}>รายการ</th>
                            <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 60 }}>จำนวน</th>
                            <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 70 }}>หน่วย</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 90 }}>ราคา/หน่วย</th>
                            <th style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, fontWeight: 600, width: 100 }}>จำนวนเงิน</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotation.items.map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12 }}>{item.product.code}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12 }}>{item.product.name}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'center' }}>{item.unitName || item.product.unit}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right' }}>{formatCurrency(item.totalPrice)}</td>
                            </tr>
                        ))}
                        {/* Empty rows */}
                        {Array.from({ length: Math.max(0, 8 - quotation.items.length) }).map((_, i) => (
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

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <table style={{ borderCollapse: 'collapse', width: 300 }}>
                        <tbody>
                            {quotation.discount > 0 && (<>
                                <tr>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#666' }}>ยอดรวมสินค้า</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', width: 100 }}>{formatCurrency(subtotal)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#dc2626' }}>ส่วนลด</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(quotation.discount)}</td>
                                </tr>
                            </>)}
                            <tr style={{ borderTop: '2px solid #333' }}>
                                <td style={{ padding: '6px 8px', fontSize: 14, textAlign: 'right', fontWeight: 700 }}>ยอดรวมทั้งสิ้น</td>
                                <td style={{ padding: '6px 8px', fontSize: 14, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(quotation.totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Notes */}
                {quotation.notes && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>หมายเหตุ:</div>
                        <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap' }}>{quotation.notes}</div>
                    </div>
                )}

                {/* Validity note */}
                <div style={{ marginBottom: 12, fontSize: 11, color: '#888', textAlign: 'center' }}>
                    ใบเสนอราคานี้มีอายุ{quotation.validUntil ? `ถึงวันที่ ${formatDate(quotation.validUntil)}` : ' 30 วัน นับจากวันที่ออก'}
                    &nbsp;| ราคาอาจเปลี่ยนแปลงได้ตามเงื่อนไข
                </div>

                {/* Signature */}
                <div style={{ marginTop: 'auto', paddingTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: 32 }}>
                        {['ผู้เสนอราคา', 'ผู้อนุมัติ'].map(label => (
                            <div key={label} style={{ flex: 1, textAlign: 'center', maxWidth: 250 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 50 }}>{label}</div>
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
