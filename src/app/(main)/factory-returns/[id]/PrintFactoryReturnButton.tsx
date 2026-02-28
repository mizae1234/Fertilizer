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
            // Fetch data
            const res = await fetch(`/api/factory-returns/${id}`);
            const data: FactoryReturnData = await res.json();

            // Dynamic import jsPDF
            const { default: jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            // Helper: ArrayBuffer -> base64 (chunked, safe for large fonts)
            const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
                }
                return btoa(binary);
            };

            // Load Sarabun font
            const fontResp = await fetch('/fonts/Sarabun-Regular.ttf');
            const fontBuffer = await fontResp.arrayBuffer();
            const fontBase64 = arrayBufferToBase64(fontBuffer);

            const fontBoldResp = await fetch('/fonts/Sarabun-Bold.ttf');
            const fontBoldBuffer = await fontBoldResp.arrayBuffer();
            const fontBoldBase64 = arrayBufferToBase64(fontBoldBuffer);

            const doc = new jsPDF('p', 'mm', 'a4');

            // Register fonts
            doc.addFileToVFS('Sarabun-Regular.ttf', fontBase64);
            doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
            doc.addFileToVFS('Sarabun-Bold.ttf', fontBoldBase64);
            doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');

            doc.setFont('Sarabun');

            // Fix Thai combining characters for jsPDF
            // jsPDF doesn't do OpenType shaping, so we reorder above-vowels + tone marks
            const fixThai = (text: string): string => {
                // NFC normalization
                let s = text.normalize('NFC');
                // Reorder: swap above-vowel (่ ้ ๊ ๋ ์ ็) with preceding sara-am / above marks
                // Pattern: (base)(upper vowel ิ ี ึ ื ั)(tone ่้๊๋์็) → keep in NFC order
                // The main issue is sara-am (ำ = 0E33) which decomposes in some inputs
                // Also ensure ั้ / ิ้ / ี้ combinations render correctly
                s = s.replace(/\u0E33/g, '\u0E4D\u0E32'); // decompose sara-am → nikhahit + sara-aa
                return s;
            };

            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 15;
            let y = 15;

            // Header
            doc.setFontSize(18);
            doc.setFont('Sarabun', 'bold');
            doc.text(fixThai('ใบเคลมสินค้าคืนโรงงาน'), pageWidth / 2, y, { align: 'center' });
            y += 10;

            doc.setFontSize(10);
            doc.setFont('Sarabun', 'normal');
            doc.text(fixThai('เลขที่: ' + data.returnNumber), pageWidth - margin, y, { align: 'right' });
            y += 6;

            const createdDate = new Date(data.createdAt);
            const dateStr = createdDate.toLocaleString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            doc.text(fixThai('วันที่: ' + dateStr), pageWidth - margin, y, { align: 'right' });
            y += 8;

            // Info box
            doc.setDrawColor(200);
            doc.setFillColor(248, 249, 250);
            doc.rect(margin, y, pageWidth - 2 * margin, 20, 'FD');

            doc.setFontSize(10);
            doc.setFont('Sarabun', 'bold');
            doc.text(fixThai('ผู้ส่งสินค้า:'), margin + 4, y + 7);
            doc.setFont('Sarabun', 'normal');
            doc.text(fixThai(data.vendor.name), margin + 30, y + 7);

            doc.setFont('Sarabun', 'bold');
            doc.text(fixThai('ผู้สร้าง:'), margin + 4, y + 15);
            doc.setFont('Sarabun', 'normal');
            doc.text(fixThai(data.createdBy.name), margin + 22, y + 15);

            if (data.notes) {
                doc.setFont('Sarabun', 'bold');
                doc.text(fixThai('หมายเหตุ:'), pageWidth / 2, y + 7);
                doc.setFont('Sarabun', 'normal');
                doc.text(fixThai(data.notes), pageWidth / 2 + 22, y + 7);
            }

            y += 28;

            // Items table
            const formatNum = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const tableBody = data.items.map((item, idx) => [
                String(idx + 1),
                item.product.code,
                fixThai(item.product.name),
                fixThai(item.warehouse.name),
                item.quantity + ' ' + item.product.unit,
                formatNum(Number(item.unitCost)),
                formatNum(Number(item.totalCost)),
            ]);

            autoTable(doc, {
                startY: y,
                head: [[fixThai('#'), fixThai('รหัส'), fixThai('ชื่อสินค้า'), fixThai('คลัง'), fixThai('จำนวน'), fixThai('ราคาต้นทุน'), fixThai('รวม')]],
                body: tableBody,
                foot: [[{ content: fixThai('ยอดรวมทั้งหมด'), colSpan: 6, styles: { halign: 'right' } }, formatNum(Number(data.totalAmount))]],
                styles: {
                    font: 'Sarabun',
                    fontSize: 10,
                    cellPadding: 3,
                },
                headStyles: {
                    fillColor: [234, 88, 12],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                },
                footStyles: {
                    fillColor: [255, 247, 237],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fontSize: 11,
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { cellWidth: 22 },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 25 },
                    4: { halign: 'center', cellWidth: 25 },
                    5: { halign: 'right', cellWidth: 28 },
                    6: { halign: 'right', cellWidth: 28 },
                },
                margin: { left: margin, right: margin },
                theme: 'grid',
            });

            // Get final Y after table
            y = (doc as any).lastAutoTable.finalY + 20;

            // Check if we need a new page for signatures
            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            // Signature section
            const signWidth = (pageWidth - 2 * margin - 20) / 2;
            const leftX = margin + 10;
            const rightX = margin + signWidth + 30;

            // Dotted lines
            doc.setDrawColor(150);
            doc.setLineDashPattern([2, 2], 0);

            // Left signature - ผู้ส่งสินค้าคืน
            const signLineY = y + 20;
            doc.line(leftX, signLineY, leftX + signWidth, signLineY);
            doc.setFont('Sarabun', 'normal');
            doc.setFontSize(10);
            doc.text(fixThai('ผู้ส่งสินค้าคืน'), leftX + signWidth / 2, signLineY + 6, { align: 'center' });
            if (data.senderName) {
                doc.setFont('Sarabun', 'bold');
                doc.text(fixThai(data.senderName), leftX + signWidth / 2, signLineY - 4, { align: 'center' });
            }

            // Right signature - ผู้ตรวจนับและรับสินค้าคืน
            doc.line(rightX, signLineY, rightX + signWidth, signLineY);
            doc.setFont('Sarabun', 'normal');
            doc.text(fixThai('ผู้ตรวจนับและรับสินค้าคืน'), rightX + signWidth / 2, signLineY + 6, { align: 'center' });
            if (data.receiverName) {
                doc.setFont('Sarabun', 'bold');
                doc.text(fixThai(data.receiverName), rightX + signWidth / 2, signLineY - 4, { align: 'center' });
            }

            // Date lines under signatures
            doc.setFont('Sarabun', 'normal');
            doc.setFontSize(9);
            doc.text(fixThai('วันที่ ____/____/____'), leftX + signWidth / 2, signLineY + 14, { align: 'center' });
            doc.text(fixThai('วันที่ ____/____/____'), rightX + signWidth / 2, signLineY + 14, { align: 'center' });

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
