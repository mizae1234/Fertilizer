import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
    // Create template workbook
    const headers = [
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

    const thaiHeaders = [
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

    // Example row
    const example = [
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

    const ws = XLSX.utils.aoa_to_sheet([thaiHeaders, headers, example]);

    // Set col widths
    ws['!cols'] = [
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
