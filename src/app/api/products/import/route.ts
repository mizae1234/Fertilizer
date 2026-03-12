import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'กรุณาเลือกไฟล์ Excel' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
            return NextResponse.json({ error: 'ไฟล์ Excel ต้องมีข้อมูลอย่างน้อย 1 แถว (ไม่นับ header)' }, { status: 400 });
        }

        // Find the header row (look for the row that contains 'code' and 'name')
        let headerRowIdx = 0;
        const fieldNames = ['code', 'name', 'description', 'unit', 'pointsPerUnit', 'minStock', 'brand', 'cost', 'price', 'packaging', 'productGroup', 'initialStock'];
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const row = rows[i].map((c: any) => String(c).trim().toLowerCase());
            if (row.includes('code') && row.includes('name')) {
                headerRowIdx = i;
                break;
            }
        }

        const headerRow = rows[headerRowIdx].map((c: any) => String(c).trim().toLowerCase());

        // Map column indices
        const colMap: Record<string, number> = {};
        for (const field of fieldNames) {
            const idx = headerRow.indexOf(field.toLowerCase());
            if (idx !== -1) colMap[field] = idx;
        }

        if (!('name' in colMap)) {
            return NextResponse.json({ error: 'ไม่พบคอลัมน์ "name" ใน Excel — ต้องมีอย่างน้อย code และ name' }, { status: 400 });
        }

        // Get existing product codes to skip duplicates
        const existingProducts = await prisma.product.findMany({
            where: { deletedAt: null },
            select: { code: true },
        });
        const existingCodes = new Set(existingProducts.map(p => p.code.toLowerCase()));

        // Get last product code number for auto-generation
        const lastProduct = await prisma.product.findFirst({
            where: { deletedAt: null, code: { not: '' } },
            orderBy: { code: 'desc' },
            select: { code: true },
        });
        let nextCodeNum = 1;
        if (lastProduct) {
            const num = parseInt(lastProduct.code.replace(/\D/g, ''));
            if (!isNaN(num)) nextCodeNum = num + 1;
        }

        const dataRows = rows.slice(headerRowIdx + 1);
        const results = { created: 0, skipped: 0, errors: [] as string[] };

        // Cache product groups by name for lookup
        const allGroups = await prisma.productGroup.findMany({ select: { id: true, name: true } });
        const groupMap = new Map(allGroups.map(g => [g.name.toLowerCase(), g.id]));

        // Get default warehouse (first active)
        const defaultWarehouse = await prisma.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
        if (!defaultWarehouse) {
            return NextResponse.json({ error: 'ไม่พบคลังสินค้า กรุณาสร้างคลังสินค้าก่อน' }, { status: 400 });
        }

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || row.length === 0) continue;

            const getValue = (field: string) => {
                const idx = colMap[field];
                if (idx === undefined || idx >= row.length) return null;
                const val = row[idx];
                return val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : null;
            };

            const name = getValue('name');
            if (!name) {
                results.skipped++;
                continue;
            }

            let code = getValue('code');
            if (!code) {
                // Auto-generate code
                code = String(nextCodeNum).padStart(5, '0');
                nextCodeNum++;
            }

            // Check duplicate code
            if (existingCodes.has(code.toLowerCase())) {
                results.errors.push(`แถว ${i + 1}: รหัส "${code}" มีอยู่แล้ว — ข้าม`);
                results.skipped++;
                continue;
            }

            // Resolve productGroup
            let productGroupId: string | null = null;
            const groupName = getValue('productGroup');
            if (groupName) {
                const key = groupName.toLowerCase();
                if (groupMap.has(key)) {
                    productGroupId = groupMap.get(key)!;
                } else {
                    // Auto-create group
                    const newGroup = await prisma.productGroup.create({ data: { name: groupName } });
                    groupMap.set(key, newGroup.id);
                    productGroupId = newGroup.id;
                }
            }

            // Helper: strip commas/spaces before parsing numbers (e.g. "1,000" → 1000)
            const parseNum = (val: string | null, fallback = 0) => {
                if (!val) return fallback;
                const cleaned = val.replace(/[,\s]/g, '');
                const n = parseFloat(cleaned);
                return isNaN(n) ? fallback : n;
            };

            try {
                await prisma.product.create({
                    data: {
                        code,
                        name,
                        description: getValue('description') || null,
                        unit: getValue('unit') || 'ชิ้น',
                        pointsPerUnit: Math.floor(parseNum(getValue('pointsPerUnit'), 0)),
                        minStock: Math.floor(parseNum(getValue('minStock'), 10)),
                        brand: getValue('brand') || null,
                        cost: parseNum(getValue('cost'), 0),
                        price: parseNum(getValue('price'), 0),
                        packaging: getValue('packaging') || null,
                        productGroupId,
                    },
                });
                existingCodes.add(code.toLowerCase());
                results.created++;

                // Create initial stock if specified
                const initialStock = Math.floor(parseNum(getValue('initialStock'), 0));
                if (initialStock > 0) {
                    const costVal = parseNum(getValue('cost'), 0);
                    const createdProduct = await prisma.product.findFirst({ where: { code }, select: { id: true } });
                    if (createdProduct) {
                        await prisma.productStock.create({
                            data: {
                                productId: createdProduct.id,
                                warehouseId: defaultWarehouse.id,
                                quantity: initialStock,
                                avgCost: costVal,
                                lastCost: costVal,
                            },
                        });
                        await prisma.stockTransaction.create({
                            data: {
                                productId: createdProduct.id,
                                warehouseId: defaultWarehouse.id,
                                type: 'GOODS_RECEIVE',
                                quantity: initialStock,
                                unitCost: costVal,
                                notes: 'สต็อกตั้งต้น (Import Excel)',
                            },
                        });
                    }
                }
            } catch (error: any) {
                results.errors.push(`แถว ${i + 1}: ${error.message?.substring(0, 100)}`);
                results.skipped++;
            }
        }

        return NextResponse.json(results);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์' }, { status: 500 });
    }
}
