'use client';

import { useState } from 'react';

export default function ExportProductsButton() {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/products/export');
            const products = await res.json();

            // BOM for Excel to recognize UTF-8
            const BOM = '\uFEFF';
            const headers = ['รหัส', 'ชื่อสินค้า', 'หมวดหมู่', 'ยี่ห้อ', 'บรรจุภัณฑ์', 'หน่วย', 'ต้นทุน', 'ราคาขาย', 'Stock รวม', 'Stock แยกคลัง'];

            const rows = products.map((p: any) => {
                const totalStock = p.productStocks.reduce((s: number, ps: any) => s + ps.quantity, 0);
                const stockDetail = p.productStocks.map((ps: any) => `${ps.warehouse.name}: ${ps.quantity}`).join(' | ');
                return [
                    p.code,
                    p.name,
                    p.productGroup?.name || '',
                    p.brand || '',
                    p.packaging || '',
                    p.unit,
                    Number(p.cost),
                    Number(p.price),
                    totalStock,
                    stockDetail,
                ];
            });

            const csvContent = BOM + [
                headers.join(','),
                ...rows.map((row: any[]) =>
                    row.map(cell => {
                        const s = String(cell);
                        return s.includes(',') || s.includes('"') || s.includes('\n')
                            ? `"${s.replace(/"/g, '""')}"`
                            : s;
                    }).join(',')
                ),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `products_${date}.csv`;
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
