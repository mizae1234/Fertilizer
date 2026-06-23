'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { formatCurrency } from '@/lib/utils';

interface GoodsReceiveData {
    id: string;
    grNumber: string;
    poNumber: string | null;
    receivedDate: string;
    createdAt: string;
    totalAmount: number | string;
    notes: string | null;
    vendor: { name: string; phone: string | null; lineId: string | null };
    createdBy: { name: string };
    items: {
        id: string;
        quantity: number;
        unitCost: number | string;
        totalCost: number | string;
        lotNo: string | null;
        product: { name: string; code: string; unit: string };
        warehouse: { name: string };
    }[];
}

export default function PrintGoodsReceiveButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);
    const user = useUser();

    const handlePrint = async () => {
        setLoading(true);
        try {
            // Fetch data + shop info + template (for logo fallback)
            const [res, shopRes, tmplRes] = await Promise.all([
                fetch(`/api/goods-receive/${id}`),
                fetch('/api/shop-info').catch(() => null),
                fetch('/api/receipt-template').catch(() => null),
            ]);
            const data: GoodsReceiveData = await res.json();
            const shopInfo = shopRes ? await shopRes.json().catch(() => null) : null;
            const templates = tmplRes ? await tmplRes.json().catch(() => []) : [];
            const template = Array.isArray(templates) ? templates.find((t: any) => t.isDefault) || templates[0] : null;
            const logoUrl = shopInfo?.logoUrl || template?.logoUrl || null;

            // Dynamic import
            const { default: jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas-pro')).default;

            const receivedDate = new Date(data.receivedDate);
            const dateStr = receivedDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

            const isStaff = user?.role === 'STAFF';

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
    </style>

    ${logoUrl ? `<div style="text-align:center;margin-bottom:8px;"><img src="${logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain;display:block;margin:0 auto;" /></div>` : ''}
    ${shopInfo?.name ? `<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:2px;">${shopInfo.name}</div>` : ''}
    ${shopInfo?.address ? `<div style="text-align:center;font-size:10px;color:#666;margin-bottom:6px;">${shopInfo.address}</div>` : ''}
    <h1 style="text-align:center;font-size:18px;margin-bottom:8px;font-weight:700;border-top:1px solid #e5e7eb;padding-top:8px;">ใบรับสินค้า (Goods Receive)</h1>

    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:12px;">
            <div><strong>ผู้ส่งสินค้า:</strong> ${data.vendor.name}</div>
            ${data.vendor.phone ? `<div><strong>เบอร์โทร:</strong> ${data.vendor.phone}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:12px;">
            <div>เลขที่เอกสาร: <strong>${data.grNumber}</strong></div>
            ${data.poNumber ? `<div>เลขที่ PO: <strong>${data.poNumber}</strong></div>` : ''}
            <div>วันที่รับสินค้า: ${dateStr}</div>
        </div>
    </div>

    <div style="background:#f8f9fa;border:1px solid #ddd;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:12px;">
        <div><strong>ผู้บันทึก:</strong> ${data.createdBy.name}</div>
        ${data.notes ? `<div style="margin-top:4px;"><strong>หมายเหตุ:</strong> ${data.notes}</div>` : ''}
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:30px;">#</th>
                <th style="width:90px;">รหัส</th>
                <th>ชื่อสินค้า</th>
                <th style="width:80px;">คลัง</th>
                <th style="width:70px;">Lot No.</th>
                <th style="width:80px;" class="center">จำนวน</th>
                ${!isStaff ? `<th style="width:80px;" class="right">ต้นทุน/หน่วย</th>` : ''}
                ${!isStaff ? `<th style="width:90px;" class="right">รวม</th>` : ''}
            </tr>
        </thead>
        <tbody>
            ${data.items.map((item, idx) => `
            <tr>
                <td class="center">${idx + 1}</td>
                <td>${item.product.code}</td>
                <td>${item.product.name}</td>
                <td>${item.warehouse.name}</td>
                <td>${item.lotNo || '-'}</td>
                <td class="center">${item.quantity} ${item.product.unit}</td>
                ${!isStaff ? `<td class="right">${formatCurrency(Number(item.unitCost))}</td>` : ''}
                ${!isStaff ? `<td class="right font-semibold">${formatCurrency(Number(item.totalCost))}</td>` : ''}
            </tr>`).join('')}
        </tbody>
    </table>

    ${!isStaff ? `
    <div style="margin-top:14px;display:flex;justify-content:flex-end;">
        <div style="width:250px;font-size:13px;border-top:1.5px solid #333;padding-top:8px;">
            <div style="display:flex;justify-content:space-between;font-weight:700;">
                <span>มูลค่ารวม:</span>
                <span style="color:#059669;">${formatCurrency(Number(data.totalAmount))}</span>
            </div>
        </div>
    </div>
    ` : ''}

    <div style="margin-top:50px;display:flex;justify-content:space-around;">
        <div style="text-align:center;width:200px;">
            <div style="height:20px;"></div>
            <div style="border-top:1px dashed #999;padding-top:6px;font-size:11px;">ผู้ตรวจสอบ/รับสินค้า</div>
            <div style="font-size:10px;color:#888;margin-top:6px;">วันที่ ____/____/____</div>
        </div>
        <div style="text-align:center;width:200px;">
            <div style="height:20px;"></div>
            <div style="border-top:1px dashed #999;padding-top:6px;font-size:11px;">ผู้อนุมัติ</div>
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

            // Scale to fit page height if too tall
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

            // Cleanup
            document.body.removeChild(container);

            // Save
            doc.save(`${data.grNumber}.pdf`);
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
