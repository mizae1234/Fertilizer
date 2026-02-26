// @ts-ignore - Generated after prisma generate
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// @ts-ignore - Prisma 7 driver adapter
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 เริ่มต้น seed data...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'ผู้ดูแลระบบ',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log('✅ สร้าง Admin user:', admin.username);

    // Create another user
    const staff = await prisma.user.upsert({
        where: { username: 'staff' },
        update: {},
        create: {
            username: 'staff',
            name: 'พนักงานขาย',
            password: await bcrypt.hash('staff123', 10),
            role: 'STAFF',
            allowedMenus: ['/pos', '/sales', '/overdue-bills', '/products', '/customers', '/warehouses'],
        },
    });
    console.log('✅ สร้าง Staff user:', staff.username);

    // Create warehouses
    const warehouse1 = await prisma.warehouse.upsert({
        where: { id: 'wh-main' },
        update: {},
        create: { id: 'wh-main', name: 'คลังหลัก', location: 'กรุงเทพฯ', isActive: true },
    });
    const warehouse2 = await prisma.warehouse.upsert({
        where: { id: 'wh-branch1' },
        update: {},
        create: { id: 'wh-branch1', name: 'คลังสาขา 1', location: 'เชียงใหม่', isActive: true },
    });
    const warehouse3 = await prisma.warehouse.upsert({
        where: { id: 'wh-branch2' },
        update: {},
        create: { id: 'wh-branch2', name: 'คลังสาขา 2', location: 'ขอนแก่น', isActive: true },
    });
    console.log('✅ สร้าง 3 คลังสินค้า');

    // Create customer groups
    const retailGroup = await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าปลีก' },
        update: {},
        create: { id: 'grp-retail', name: 'ลูกค้าปลีก' },
    });
    const wholesaleGroup = await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าส่ง' },
        update: {},
        create: { id: 'grp-wholesale', name: 'ลูกค้าส่ง' },
    });
    console.log('✅ สร้าง 2 กลุ่มลูกค้า');

    // Create products
    const products = [
        { id: 'prod-1', code: 'FT-001', name: 'ปุ๋ยเคมี 15-15-15', unit: 'bag', pointsPerUnit: 5, minStock: 50 },
        { id: 'prod-2', code: 'FT-002', name: 'ปุ๋ยเคมี 46-0-0 (ยูเรีย)', unit: 'bag', pointsPerUnit: 3, minStock: 50 },
        { id: 'prod-3', code: 'FT-003', name: 'ปุ๋ยเคมี 16-20-0', unit: 'bag', pointsPerUnit: 4, minStock: 30 },
        { id: 'prod-4', code: 'FT-004', name: 'ปุ๋ยอินทรีย์ ตรามงกุฎ', unit: 'bag', pointsPerUnit: 2, minStock: 40 },
        { id: 'prod-5', code: 'FT-005', name: 'ปุ๋ยน้ำ สูตรเร่งการเจริญเติบโต', unit: 'bottle', pointsPerUnit: 3, minStock: 20 },
        { id: 'prod-6', code: 'FT-006', name: 'ปุ๋ยทางใบ สูตรออร์แกนิค', unit: 'bottle', pointsPerUnit: 2, minStock: 15 },
        { id: 'prod-7', code: 'FT-007', name: 'ดินปลูก ผสมสำเร็จ', unit: 'bag', pointsPerUnit: 1, minStock: 100 },
        { id: 'prod-8', code: 'FT-008', name: 'ยากำจัดวัชพืช สูตรเข้มข้น', unit: 'bottle', pointsPerUnit: 4, minStock: 25 },
    ];

    for (const prod of products) {
        await prisma.product.upsert({
            where: { id: prod.id },
            update: {},
            create: prod,
        });
    }
    console.log('✅ สร้าง 8 สินค้า');

    // Create product prices per group
    const prices = [
        { productId: 'prod-1', customerGroupId: 'grp-retail', price: 750 },
        { productId: 'prod-1', customerGroupId: 'grp-wholesale', price: 680 },
        { productId: 'prod-2', customerGroupId: 'grp-retail', price: 650 },
        { productId: 'prod-2', customerGroupId: 'grp-wholesale', price: 590 },
        { productId: 'prod-3', customerGroupId: 'grp-retail', price: 720 },
        { productId: 'prod-3', customerGroupId: 'grp-wholesale', price: 650 },
        { productId: 'prod-4', customerGroupId: 'grp-retail', price: 350 },
        { productId: 'prod-4', customerGroupId: 'grp-wholesale', price: 300 },
        { productId: 'prod-5', customerGroupId: 'grp-retail', price: 280 },
        { productId: 'prod-5', customerGroupId: 'grp-wholesale', price: 240 },
        { productId: 'prod-6', customerGroupId: 'grp-retail', price: 220 },
        { productId: 'prod-6', customerGroupId: 'grp-wholesale', price: 190 },
        { productId: 'prod-7', customerGroupId: 'grp-retail', price: 120 },
        { productId: 'prod-7', customerGroupId: 'grp-wholesale', price: 100 },
        { productId: 'prod-8', customerGroupId: 'grp-retail', price: 450 },
        { productId: 'prod-8', customerGroupId: 'grp-wholesale', price: 400 },
    ];

    for (const price of prices) {
        const existing = await prisma.productPrice.findFirst({
            where: { productId: price.productId, customerGroupId: price.customerGroupId },
        });
        if (!existing) {
            await prisma.productPrice.create({ data: price });
        }
    }
    console.log('✅ สร้าง 16 ราคาสินค้า');

    // Create product stocks (initial warehouse stock)
    const stocks = [
        { productId: 'prod-1', warehouseId: 'wh-main', quantity: 200, avgCost: 600, lastCost: 600 },
        { productId: 'prod-1', warehouseId: 'wh-branch1', quantity: 80, avgCost: 600, lastCost: 600 },
        { productId: 'prod-2', warehouseId: 'wh-main', quantity: 150, avgCost: 500, lastCost: 500 },
        { productId: 'prod-2', warehouseId: 'wh-branch1', quantity: 60, avgCost: 500, lastCost: 500 },
        { productId: 'prod-3', warehouseId: 'wh-main', quantity: 100, avgCost: 550, lastCost: 550 },
        { productId: 'prod-4', warehouseId: 'wh-main', quantity: 180, avgCost: 250, lastCost: 250 },
        { productId: 'prod-4', warehouseId: 'wh-branch2', quantity: 50, avgCost: 250, lastCost: 250 },
        { productId: 'prod-5', warehouseId: 'wh-main', quantity: 90, avgCost: 200, lastCost: 200 },
        { productId: 'prod-6', warehouseId: 'wh-main', quantity: 70, avgCost: 160, lastCost: 160 },
        { productId: 'prod-7', warehouseId: 'wh-main', quantity: 300, avgCost: 80, lastCost: 80 },
        { productId: 'prod-7', warehouseId: 'wh-branch1', quantity: 120, avgCost: 80, lastCost: 80 },
        { productId: 'prod-7', warehouseId: 'wh-branch2', quantity: 80, avgCost: 80, lastCost: 80 },
        { productId: 'prod-8', warehouseId: 'wh-main', quantity: 5, avgCost: 350, lastCost: 350 }, // Low stock!
    ];

    for (const stock of stocks) {
        const key = { productId: stock.productId, warehouseId: stock.warehouseId };
        const existing = await prisma.productStock.findFirst({ where: key });
        if (!existing) {
            await prisma.productStock.create({ data: stock });
        }
    }
    console.log('✅ สร้าง stock เริ่มต้น');

    // Create customers
    const customersData = [
        { id: 'cust-1', name: 'สมชาย การเกษตร', phone: '0812345678', customerGroupId: 'grp-retail', totalPoints: 150 },
        { id: 'cust-2', name: 'วิชัย ฟาร์ม', phone: '0823456789', customerGroupId: 'grp-wholesale', totalPoints: 500 },
        { id: 'cust-3', name: 'ร้านค้าเกษตรสุข', phone: '0834567890', customerGroupId: 'grp-wholesale', totalPoints: 320 },
        { id: 'cust-4', name: 'สมศรี ไร่ทอง', phone: '0845678901', customerGroupId: 'grp-retail', totalPoints: 80 },
        { id: 'cust-5', name: 'ประเสริฐ เกษตรกร', phone: '0856789012', customerGroupId: 'grp-retail', totalPoints: 45 },
    ];

    for (const cust of customersData) {
        await prisma.customer.upsert({
            where: { id: cust.id },
            update: {},
            create: cust,
        });
    }
    console.log('✅ สร้าง 5 ลูกค้า');

    // Create vendors
    const vendor1 = await prisma.vendor.upsert({
        where: { id: 'vendor-1' },
        update: {},
        create: {
            id: 'vendor-1',
            name: 'บริษัท ปุ๋ยไทย จำกัด',
            phone: '0812223333',
            lineId: 'puythai',
            address: '123 ถ.พหลโยธิน กรุงเทพฯ',
        },
    });
    const vendor2 = await prisma.vendor.upsert({
        where: { id: 'vendor-2' },
        update: {},
        create: {
            id: 'vendor-2',
            name: 'ห้างหุ้นส่วน เคมีภัณฑ์เกษตร',
            phone: '0833445566',
            lineId: 'chemfarm',
            address: '456 ถ.วิภาวดี กรุงเทพฯ',
        },
    });
    const vendor3 = await prisma.vendor.upsert({
        where: { id: 'vendor-3' },
        update: {},
        create: {
            id: 'vendor-3',
            name: 'ร้านปุ๋ยคุณภาพ',
            phone: '0899887766',
        },
    });
    console.log('✅ สร้าง 3 ผู้ขาย');

    // Create sample Goods Receive (APPROVED)
    const gr1 = await prisma.goodsReceive.upsert({
        where: { id: 'gr-1' },
        update: {},
        create: {
            id: 'gr-1',
            grNumber: 'GR-2568-001',
            vendorId: vendor1.id,
            status: 'APPROVED',
            totalAmount: 60000,
            createdById: admin.id,
        },
    });

    await prisma.goodsReceiveItem.upsert({
        where: { id: 'gri-1' },
        update: {},
        create: {
            id: 'gri-1',
            goodsReceiveId: gr1.id,
            productId: 'prod-1',
            warehouseId: 'wh-main',
            quantity: 100,
            unitCost: 600,
            totalCost: 60000,
        },
    });

    // Create sample Goods Receive (PENDING)
    const gr2 = await prisma.goodsReceive.upsert({
        where: { id: 'gr-2' },
        update: {},
        create: {
            id: 'gr-2',
            grNumber: 'GR-2568-002',
            vendorId: vendor2.id,
            status: 'PENDING',
            totalAmount: 45000,
            notes: 'สั่งผ่าน LINE รอตรวจสอบ',
            createdById: staff.id,
        },
    });

    await prisma.goodsReceiveItem.upsert({
        where: { id: 'gri-2' },
        update: {},
        create: {
            id: 'gri-2',
            goodsReceiveId: gr2.id,
            productId: 'prod-2',
            warehouseId: 'wh-main',
            quantity: 50,
            unitCost: 500,
            totalCost: 25000,
        },
    });

    await prisma.goodsReceiveItem.upsert({
        where: { id: 'gri-3' },
        update: {},
        create: {
            id: 'gri-3',
            goodsReceiveId: gr2.id,
            productId: 'prod-4',
            warehouseId: 'wh-branch1',
            quantity: 80,
            unitCost: 250,
            totalCost: 20000,
        },
    });

    console.log('✅ สร้าง 2 รายการรับสินค้าตัวอย่าง');

    // Create sample Sale (PENDING)
    const sale1 = await prisma.sale.upsert({
        where: { id: 'sale-1' },
        update: {},
        create: {
            id: 'sale-1',
            saleNumber: 'SL-2568-001',
            customerId: 'cust-1',
            status: 'PENDING',
            totalAmount: 3750,
            totalPoints: 25,
            createdById: staff.id,
        },
    });

    await prisma.saleItem.upsert({
        where: { id: 'si-1' },
        update: {},
        create: {
            id: 'si-1',
            saleId: sale1.id,
            productId: 'prod-1',
            warehouseId: 'wh-main',
            quantity: 5,
            unitPrice: 750,
            totalPrice: 3750,
            points: 25,
        },
    });

    console.log('✅ สร้าง 1 รายการขายตัวอย่าง');

    console.log('');
    console.log('🎉 Seed data เสร็จสมบูรณ์!');
    console.log('');
    console.log('📧 Login Credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Staff: staff / staff123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
