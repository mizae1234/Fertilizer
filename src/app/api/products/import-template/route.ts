import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET() {
    const warehouses = await prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });

    // Create template workbook
    const baseHeaders = [
        'code',
        'name',
        'description',
        'unit',
        'pointsPerUnit',
        'minStock',
        'brand',
        'cost',
        'price',
        'packaging',
        'productGroup',
    ];

    const baseThaiHeaders = [
        'รหัสสินค้า',
        'ชื่อสินค้า *',
        'คำอธิบาย',
        'หน่วยนับ *',
        'แต้มต่อหน่วย',
        'สต็อกขั้นต่ำ',
        'ยี่ห้อ',
        'ราคาทุน',
        'ราคาขาย',
        'บรรจุภัณฑ์',
        'หมวดหมู่สินค้า',
    ];

    const warehouseHeaders = warehouses.map(w => `stock_${w.id}`);
    const warehouseThaiHeaders = warehouses.map(w => `สต็อกตั้งต้น: ${w.name}`);

    const headers = [...baseHeaders, ...warehouseHeaders];
    const thaiHeaders = [...baseThaiHeaders, ...warehouseThaiHeaders];

    // Example row
    const baseExample = [
        '00001',
        'ปุ๋ยยูเรีย 46-0-0',
        'ปุ๋ยเคมี สูตร 46-0-0',
        'ถุง',
        1,
        10,
        'ตราหัววัว',
        450,
        550,
        'ถุง 50 กก.',
        'ปุ๋ยเคมี',
    ];
    
    // Add 100 stock for the first warehouse, and 0 for the rest
    const warehouseExample = warehouses.map((_, i) => i === 0 ? 100 : 0);
    const example = [...baseExample, ...warehouseExample];

    const ws = XLSX.utils.aoa_to_sheet([thaiHeaders, headers, example]);

    // Set col widths
    const baseCols = [
        { wch: 12 },
        { wch: 30 },
        { wch: 25 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
    ];
    
    const warehouseCols = warehouses.map(() => ({ wch: 25 }));
    ws['!cols'] = [...baseCols, ...warehouseCols];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="product_import_template.xlsx"',
        },
    });
}
