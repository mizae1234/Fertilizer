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
    ];

    const ws = XLSX.utils.aoa_to_sheet([thaiHeaders, headers, example]);

    // Set col widths
    ws['!cols'] = [
        { wch: 12 }, // code
        { wch: 30 }, // name
        { wch: 25 }, // description
        { wch: 10 }, // unit
        { wch: 12 }, // pointsPerUnit
        { wch: 12 }, // minStock
        { wch: 15 }, // brand
        { wch: 12 }, // cost
        { wch: 12 }, // price
        { wch: 18 }, // packaging
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
