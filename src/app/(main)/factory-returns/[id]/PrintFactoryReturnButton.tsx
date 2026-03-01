'use client';

import { useState } from 'react';

interface FactoryReturnData {
    returnNumber: string;
    vendor: { name: string };
    createdBy: { name: string };
    totalAmount: string;
    notes: string | null;
    senderName: string | null;
    receiverName: string | null;
    createdAt: string;
    items: {
        id: string;
        quantity: number;
        unitCost: string;
        totalCost: string;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

export default function PrintFactoryReturnButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);

    const handlePrint = async () => {
        setLoading(true);
        try {
            // Fetch data + shop info + template (for logo fallback)
            const [res, shopRes, tmplRes] = await Promise.all([
                fetch(`/api/factory-returns/${id}`),
                fetch('/api/shop-info').catch(() => null),
                fetch('/api/receipt-templates').catch(() => null),
            ]);
            const data: FactoryReturnData = await res.json();
            const shopInfo = shopRes ? await shopRes.json().catch(() => null) : null;
            const templates = tmplRes ? await tmplRes.json().catch(() => []) : [];
            const template = Array.isArray(templates) ? templates.find((t: any) => t.isDefault) || templates[0] : null;
            const logoUrl = shopInfo?.logoUrl || template?.logoUrl || null;

            // Dynamic import
            const { default: jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas-pro')).default;

            const formatNum = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const createdDate = new Date(data.createdAt);
            const dateStr = createdDate.toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            // Build HTML content
            const html = `
<div id="pdf-content" style="width:700px;padding:30px;font-family:'Sarabun',sans-serif;font-size:13px;color:#222;background:#fff;">
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
        .footer-row td { background: #fff; font-weight: 700; font-size: 13px; border-top: 2px solid #e5e7eb; }
    </style>

    ${logoUrl ? `<div style="text-align:center;margin-bottom:8px;"><img src="${logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain;display:block;margin:0 auto;" /></div>` : ''}
    ${shopInfo?.name ? `<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:2px;">${shopInfo.name}</div>` : ''}
    ${shopInfo?.address ? `<div style="text-align:center;font-size:10px;color:#666;margin-bottom:6px;">${shopInfo.address}</div>` : ''}
    <h1 style="text-align:center;font-size:18px;margin-bottom:8px;font-weight:700;border-top:1px solid #e5e7eb;padding-top:8px;">ใบเคลมสินค้าคืนโรงงาน</h1>

    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <div></div>
        <div style="text-align:right;font-size:12px;">
            <div>เลขที่: <strong>${data.returnNumber}</strong></div>
            <div>วันที่: ${dateStr}</div>
        </div>
    </div>

    <div style="background:#f8f9fa;border:1px solid #ddd;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:12px;">
        <div style="margin-bottom:4px;"><strong>ผู้ขาย/โรงงาน/บริษัท:</strong> ${data.vendor.name}</div>
        <div><strong>ผู้สร้าง:</strong> ${data.createdBy.name}</div>
        ${data.notes ? `<div style="margin-top:4px;"><strong>หมายเหตุ:</strong> ${data.notes}</div>` : ''}
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:30px;">#</th>
                <th style="width:60px;">รหัส</th>
                <th>ชื่อสินค้า</th>
                <th style="width:70px;">คลัง</th>
                <th style="width:70px;" class="center">จำนวน</th>
                <th style="width:80px;" class="right">ราคาต้นทุน</th>
                <th style="width:80px;" class="right">รวม</th>
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
                <td class="right">${formatNum(Number(item.unitCost))}</td>
                <td class="right">${formatNum(Number(item.totalCost))}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
            <tr class="footer-row">
                <td colspan="6" class="right" style="font-size:13px;">ยอดรวมทั้งหมด</td>
                <td class="right" style="font-size:15px;color:#ea580c;font-weight:700;">${formatNum(Number(data.totalAmount))}</td>
            </tr>
        </tfoot>
    </table>

    <div style="margin-top:50px;display:flex;justify-content:space-around;">
        <div style="text-align:center;width:200px;">
            ${data.senderName ? `<div style="font-weight:700;margin-bottom:4px;">${data.senderName}</div>` : '<div style="height:20px;"></div>'}
            <div style="border-top:1px dashed #999;padding-top:6px;font-size:11px;">ผู้ส่งสินค้าคืน</div>
            <div style="font-size:10px;color:#888;margin-top:6px;">วันที่ ____/____/____</div>
        </div>
        <div style="text-align:center;width:200px;">
            ${data.receiverName ? `<div style="font-weight:700;margin-bottom:4px;">${data.receiverName}</div>` : '<div style="height:20px;"></div>'}
            <div style="border-top:1px dashed #999;padding-top:6px;font-size:11px;">ผู้ตรวจนับและรับสินค้าคืน</div>
            <div style="font-size:10px;color:#888;margin-top:6px;">วันที่ ____/____/____</div>
        </div>
    </div>
</div>`;

            // Create a temporary container
            const container = document.createElement('div');
            container.innerHTML = html;
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            document.body.appendChild(container);

            // Wait for font to load
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 300));

            const element = container.querySelector('#pdf-content') as HTMLElement;

            // Render to canvas
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            // Create PDF
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const doc = new jsPDF('p', 'mm', 'a4');

            // If content is taller than A4, scale it to fit
            const pageHeight = 297; // A4 height
            if (imgHeight > pageHeight - 10) {
                const scale = (pageHeight - 10) / imgHeight;
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;
                const xOffset = (imgWidth - scaledWidth) / 2;
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, 5, scaledWidth, scaledHeight);
            } else {
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 5, imgWidth, imgHeight);
            }

            // Cleanup
            document.body.removeChild(container);

            // Save
            doc.save(`${data.returnNumber}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
        }
        setLoading(false);
    };

    return (
        <button onClick={handlePrint} disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-600 shadow-md disabled:opacity-50 transition-all">
            {loading ? '⏳ กำลังสร้าง PDF...' : '🖨️ พิมพ์ PDF'}
        </button>
    );
}
