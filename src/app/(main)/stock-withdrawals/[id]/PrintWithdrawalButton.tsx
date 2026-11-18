'use client';

import { useState } from 'react';

interface WithdrawalData {
    withdrawalNumber: string;
    requesterName: string;
    createdBy: { name: string };
    notes: string | null;
    approverName: string | null;
    packerName?: string | null;
    withdrawerName: string | null;
    createdAt: string;
    items: {
        id: string;
        quantity: number;
        notes?: string | null;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

export default function PrintWithdrawalButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);
    const [copyMode, setCopyMode] = useState<'both' | 'original' | 'copy'>('both');

    const handlePrint = async () => {
        setLoading(true);
        try {
            // Fetch data + shop info + template (for logo fallback)
            const [res, shopRes, tmplRes] = await Promise.all([
                fetch(`/api/stock-withdrawals/${id}`),
                fetch('/api/shop-info').catch(() => null),
                fetch('/api/receipt-template').catch(() => null),
            ]);
            const data: WithdrawalData = await res.json();
            const shopInfo = shopRes ? await shopRes.json().catch(() => null) : null;
            const templates = tmplRes ? await tmplRes.json().catch(() => []) : [];
            const template = Array.isArray(templates) ? templates.find((t: any) => t.isDefault) || templates[0] : null;
            const logoUrl = shopInfo?.logoUrl || template?.logoUrl || null;
            const shopTitle = shopInfo?.name || template?.headerText?.split('\n')[0] || '';

            // Dynamic import
            const { default: jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas-pro')).default;

            const createdDate = new Date(data.createdAt);
            const dateStr = createdDate.toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const copyLabels: ('ต้นฉบับ' | 'สำเนา')[] =
                copyMode === 'both' ? ['ต้นฉบับ', 'สำเนา'] : copyMode === 'original' ? ['ต้นฉบับ'] : ['สำเนา'];

            const receiverSignName = (data.withdrawerName || data.requesterName || '').trim();
            const packerSignName = (data.packerName || '').trim();
            // If legacy record stored shopTitle in approverName by old default, leave blank so approver has a clean signature block
            const rawApprover = (data.approverName || '').trim();
            const approverSignName = rawApprover && rawApprover !== shopTitle.trim() ? rawApprover : '';
            const doc = new jsPDF('p', 'mm', 'a4');

            for (let cIdx = 0; cIdx < copyLabels.length; cIdx++) {
                const copyLabel = copyLabels[cIdx];
                const isOriginal = copyLabel === 'ต้นฉบับ';
                if (cIdx > 0) doc.addPage();

                const html = `
<div id="pdf-content" style="width:700px;padding:30px;font-family:'Sarabun',sans-serif;font-size:13px;color:#222;background:#fff;position:relative;">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
        th { background: #f9fafb; color: #6b7280; font-weight: 600; text-align: left; font-size: 11px; border-bottom: 1px solid #e5e7eb; border-top: none; border-left: none; border-right: none; }
        .right { text-align: right; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        td { border: none; border-bottom: 1px solid #f3f4f6; }
    </style>

    <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
        <span style="display:inline-block;padding:3px 14px;border-radius:4px;font-size:12px;font-weight:700;border:${isOriginal ? '1.5px solid #111827' : '1.5px solid #6b7280'};background:${isOriginal ? '#111827' : '#f3f4f6'};color:${isOriginal ? '#ffffff' : '#374151'};">
            ${copyLabel}
        </span>
    </div>

    ${logoUrl ? `<div style="text-align:center;margin-bottom:8px;"><img src="${logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain;display:block;margin:0 auto;" /></div>` : ''}
    ${shopTitle ? `<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:2px;">${shopTitle}</div>` : ''}
    ${shopInfo?.address ? `<div style="text-align:center;font-size:10px;color:#666;margin-bottom:6px;">${shopInfo.address}</div>` : ''}
    <h1 style="text-align:center;font-size:18px;margin-bottom:8px;font-weight:700;border-top:1px solid #e5e7eb;padding-top:8px;">ใบเบิกสินค้า</h1>

    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <div></div>
        <div style="text-align:right;font-size:12px;">
            <div>เลขที่: <strong>${data.withdrawalNumber}</strong></div>
            <div>วันที่: ${dateStr}</div>
        </div>
    </div>

    <div style="background:#f8f9fa;border:1px solid #ddd;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:12px;">
        <div style="margin-bottom:4px;"><strong>ผู้รับสินค้า:</strong> ${data.requesterName}</div>
        <div><strong>ผู้สร้าง:</strong> ${data.createdBy.name}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:30px;">#</th>
                <th style="width:80px;">รหัส</th>
                <th>ชื่อสินค้า</th>
                <th style="width:80px;">คลัง</th>
                <th style="width:90px;" class="center">จำนวน</th>
                <th style="width:140px;">หมายเหตุ</th>
            </tr>
        </thead>
        <tbody>
            ${data.items.map((item, idx) => `
            <tr>
                <td class="center">${idx + 1}</td>
                <td>${item.product.code}</td>
                <td>${item.product.name}</td>
                <td>${item.warehouse.name}</td>
                <td class="center">${item.quantity} ${item.product.unit}</td>
                <td style="color:#4b5563;">${item.notes || '-'}</td>
            </tr>`).join('')}
        </tbody>
    </table>

    ${data.notes ? `
    <div style="margin-top:12px;background:#f8f9fa;border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;font-size:12px;white-space:pre-wrap;">
        <strong>หมายเหตุ:</strong> ${data.notes}
    </div>
    ` : ''}

    <table style="width:100%;table-layout:fixed;border-collapse:collapse;margin-top:52px;border:none;">
        <tbody>
            <tr>
                <td style="border:none;padding:0 12px;text-align:center;height:48px;vertical-align:bottom;">
                    <div style="border-bottom:1px dashed #6b7280;margin:0 6px;"></div>
                </td>
                <td style="border:none;padding:0 12px;text-align:center;height:48px;vertical-align:bottom;">
                    <div style="border-bottom:1px dashed #6b7280;margin:0 6px;"></div>
                </td>
                <td style="border:none;padding:0 12px;text-align:center;height:48px;vertical-align:bottom;">
                    <div style="border-bottom:1px dashed #6b7280;margin:0 6px;"></div>
                </td>
            </tr>
            <tr>
                <td style="border:none;padding:7px 6px 2px;text-align:center;font-size:11px;color:#111827;vertical-align:top;word-break:break-word;">
                    (${receiverSignName ? ` ${receiverSignName} ` : '............................................'})
                </td>
                <td style="border:none;padding:7px 6px 2px;text-align:center;font-size:11px;color:#111827;vertical-align:top;word-break:break-word;">
                    (${packerSignName ? ` ${packerSignName} ` : '............................................'})
                </td>
                <td style="border:none;padding:7px 6px 2px;text-align:center;font-size:11px;color:#111827;vertical-align:top;word-break:break-word;">
                    (${approverSignName ? ` ${approverSignName} ` : '............................................'})
                </td>
            </tr>
            <tr>
                <td style="border:none;padding:2px 6px;text-align:center;font-size:11px;font-weight:700;color:#374151;">ผู้รับสินค้า</td>
                <td style="border:none;padding:2px 6px;text-align:center;font-size:11px;font-weight:700;color:#374151;">ผู้จัดสินค้า</td>
                <td style="border:none;padding:2px 6px;text-align:center;font-size:11px;font-weight:700;color:#374151;">ผู้อนุมัติการเบิก</td>
            </tr>
            <tr>
                <td style="border:none;padding:4px 6px 0;text-align:center;font-size:10px;color:#6b7280;">วันที่ ......../......../........</td>
                <td style="border:none;padding:4px 6px 0;text-align:center;font-size:10px;color:#6b7280;">วันที่ ......../......../........</td>
                <td style="border:none;padding:4px 6px 0;text-align:center;font-size:10px;color:#6b7280;">วันที่ ......../......../........</td>
            </tr>
        </tbody>
    </table>
</div>`;

                const container = document.createElement('div');
                container.innerHTML = html;
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                document.body.appendChild(container);

                await document.fonts.ready;
                await new Promise(r => setTimeout(r, 250));

                const element = container.querySelector('#pdf-content') as HTMLElement;
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                });

                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const pageHeight = 297;
                if (imgHeight > pageHeight - 10) {
                    const scale = (pageHeight - 10) / imgHeight;
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;
                    const xOffset = (imgWidth - scaledWidth) / 2;
                    doc.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, 5, scaledWidth, scaledHeight);
                } else {
                    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 5, imgWidth, imgHeight);
                }

                document.body.removeChild(container);
            }

            doc.save(`${data.withdrawalNumber}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
        }
        setLoading(false);
    };

    return (
        <div className="inline-flex items-center gap-1.5">
            <select
                value={copyMode}
                onChange={e => setCopyMode(e.target.value as 'both' | 'original' | 'copy')}
                className="px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="both">ต้นฉบับ + สำเนา</option>
                <option value="original">เฉพาะต้นฉบับ</option>
                <option value="copy">เฉพาะสำเนา</option>
            </select>
            <button onClick={handlePrint} disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-600 shadow-md disabled:opacity-50 transition-all">
                {loading ? '⏳ กำลังสร้าง PDF...' : '🖨️ พิมพ์ PDF'}
            </button>
        </div>
    );
}
