'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ExportProductsButton() {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/products/export');
            const products = await res.json();

            const rows = products.map((p: any) => {
                const totalStock = p.productStocks.reduce((s: number, ps: any) => s + ps.quantity, 0);
                const stockDetail = p.productStocks.map((ps: any) => `${ps.warehouse.name}: ${ps.quantity}`).join(' | ');
                return {
                    'รหัส': p.code,
                    'ชื่อสินค้า': p.name,
                    'หมวดหมู่': p.productGroup?.name || '',
                    'ยี่ห้อ': p.brand || '',
                    'บรรจุภัณฑ์': p.packaging || '',
                    'หน่วย': p.unit,
                    'ต้นทุน': Number(p.cost),
                    'ราคาขาย': Number(p.price),
                    'Stock รวม': totalStock,
                    'Stock แยกคลัง': stockDetail,
                    'ประเภทต้นทุน': p.costMethod === 'AVG' ? 'เฉลี่ย' : p.costMethod === 'LAST' ? 'ล่าสุด' : 'กำหนดเอง',
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [
                { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
                { wch: 12 }, { wch: 30 }, { wch: 15 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');

            const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `products_${date}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
        setLoading(false);
    };

    return (
        <button onClick={handleExport} disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {loading ? '⏳ กำลังส่งออก...' : '📥 Export Excel'}
        </button>
    );
}
