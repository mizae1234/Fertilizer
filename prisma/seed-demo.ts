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
    console.log('🌱 Demo Seed — สร้างข้อมูลสาธิตสำหรับ Demo Site...');
    console.log('');

    // ═══════════════════════════════════════
    // 1. Users
    // ═══════════════════════════════════════
    const adminPass = await bcrypt.hash('admin123', 10);
    const staffPass = await bcrypt.hash('demo123', 10);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'ผู้ดูแลระบบ',
            password: adminPass,
            role: 'ADMIN',
        },
    });
    console.log('✅ สร้าง Admin user:', admin.username);

    const staff = await prisma.user.upsert({
        where: { username: 'demo' },
        update: {},
        create: {
            username: 'demo',
            name: 'พนักงานสาธิต',
            password: staffPass,
            role: 'STAFF',
        },
    });
    console.log('✅ สร้าง Staff user:', staff.username);

    // ═══════════════════════════════════════
    // 2. Warehouse
    // ═══════════════════════════════════════
    const warehouse = await prisma.warehouse.upsert({
        where: { id: 'wh-main' },
        update: {},
        create: {
            id: 'wh-main',
            name: 'คลังหลัก',
            location: 'สาขาหลัก',
            isActive: true,
            isMain: true,
        },
    });
    console.log('✅ สร้างคลังหลัก');

    // ═══════════════════════════════════════
    // 3. Customer Groups
    // ═══════════════════════════════════════
    const retailGroup = await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าปลีก' },
        update: {},
        create: { name: 'ลูกค้าปลีก' },
    });
    const wholesaleGroup = await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าส่ง' },
        update: {},
        create: { name: 'ลูกค้าส่ง' },
    });
    console.log('✅ สร้างกลุ่มลูกค้า (ปลีก/ส่ง)');

    // ═══════════════════════════════════════
    // 4. Product Groups
    // ═══════════════════════════════════════
    const productGroups = [
        'ปุ๋ยเคมี',
        'ปุ๋ยอินทรีย์',
        'ยาฆ่าแมลง',
        'เมล็ดพันธุ์',
        'อุปกรณ์การเกษตร',
    ];
    const pgMap: Record<string, string> = {};
    for (const name of productGroups) {
        const pg = await prisma.productGroup.upsert({
            where: { name },
            update: {},
            create: { name },
        });
        pgMap[name] = pg.id;
    }
    console.log('✅ สร้าง 5 หมวดหมู่สินค้า');

    // ═══════════════════════════════════════
    // 5. Products (15 items)
    // ═══════════════════════════════════════
    const products = [
        // ปุ๋ยเคมี
        { code: 'P0001', name: 'ปุ๋ยสูตร 46-0-0 ยูเรีย', unit: 'กระสอบ', cost: 650, price: 780, brand: 'ตราหัววัว', packaging: '50 กก.', group: 'ปุ๋ยเคมี', minStock: 20 },
        { code: 'P0002', name: 'ปุ๋ยสูตร 15-15-15', unit: 'กระสอบ', cost: 700, price: 850, brand: 'ตราหัววัว', packaging: '50 กก.', group: 'ปุ๋ยเคมี', minStock: 20 },
        { code: 'P0003', name: 'ปุ๋ยสูตร 16-20-0', unit: 'กระสอบ', cost: 680, price: 820, brand: 'ตรากระต่าย', packaging: '50 กก.', group: 'ปุ๋ยเคมี', minStock: 15 },
        { code: 'P0004', name: 'ปุ๋ยสูตร 13-13-21', unit: 'กระสอบ', cost: 720, price: 880, brand: 'ตราม้า', packaging: '50 กก.', group: 'ปุ๋ยเคมี', minStock: 15 },
        { code: 'P0005', name: 'ปุ๋ยสูตร 0-0-60 โพแทสเซียม', unit: 'กระสอบ', cost: 800, price: 950, brand: 'ตราหัววัว', packaging: '50 กก.', group: 'ปุ๋ยเคมี', minStock: 10 },
        // ปุ๋ยอินทรีย์
        { code: 'P0006', name: 'ปุ๋ยอินทรีย์ชีวภาพ', unit: 'กระสอบ', cost: 180, price: 250, brand: 'ตราใบไม้', packaging: '25 กก.', group: 'ปุ๋ยอินทรีย์', minStock: 30 },
        { code: 'P0007', name: 'ปุ๋ยมูลไก่อัดเม็ด', unit: 'กระสอบ', cost: 120, price: 180, brand: 'ตราฟาร์ม', packaging: '25 กก.', group: 'ปุ๋ยอินทรีย์', minStock: 30 },
        { code: 'P0008', name: 'ปุ๋ยหมักสูตรเข้มข้น', unit: 'กระสอบ', cost: 200, price: 280, brand: 'ตราใบไม้', packaging: '20 กก.', group: 'ปุ๋ยอินทรีย์', minStock: 20 },
        // ยาฆ่าแมลง
        { code: 'P0009', name: 'ยาฆ่าหนอน ไซเปอร์เมทริน', unit: 'ขวด', cost: 85, price: 120, brand: 'ตราดาว', packaging: '1 ลิตร', group: 'ยาฆ่าแมลง', minStock: 50 },
        { code: 'P0010', name: 'ยาฆ่าเพลี้ย อิมิดาคลอพริด', unit: 'ซอง', cost: 35, price: 55, brand: 'ตราเสือ', packaging: '100 กรัม', group: 'ยาฆ่าแมลง', minStock: 100 },
        { code: 'P0011', name: 'ยาราดวัชพืช ไกลโฟเซต', unit: 'แกลลอน', cost: 250, price: 350, brand: 'ตราดาว', packaging: '4 ลิตร', group: 'ยาฆ่าแมลง', minStock: 20 },
        // เมล็ดพันธุ์
        { code: 'P0012', name: 'เมล็ดพันธุ์ข้าวโพดหวาน', unit: 'ถุง', cost: 150, price: 220, brand: 'แปซิฟิก', packaging: '1 กก.', group: 'เมล็ดพันธุ์', minStock: 40 },
        { code: 'P0013', name: 'เมล็ดพันธุ์ถั่วเขียว', unit: 'ถุง', cost: 80, price: 120, brand: 'ชัยพัฒนา', packaging: '1 กก.', group: 'เมล็ดพันธุ์', minStock: 40 },
        // อุปกรณ์
        { code: 'P0014', name: 'หัวฉีดพ่นยา สีเหลือง', unit: 'อัน', cost: 15, price: 30, brand: 'ไม่ระบุ', packaging: '-', group: 'อุปกรณ์การเกษตร', minStock: 100 },
        { code: 'P0015', name: 'ถังพ่นยา 20 ลิตร', unit: 'เครื่อง', cost: 850, price: 1200, brand: 'มิตซูบิชิ', packaging: '-', group: 'อุปกรณ์การเกษตร', minStock: 5 },
    ];

    for (const p of products) {
        const product = await prisma.product.upsert({
            where: { code: p.code },
            update: {},
            create: {
                code: p.code,
                name: p.name,
                unit: p.unit,
                cost: p.cost,
                price: p.price,
                brand: p.brand,
                packaging: p.packaging,
                productGroupId: pgMap[p.group],
                minStock: p.minStock,
                pointsPerUnit: Math.floor(p.price / 100),
            },
        });

        // Create stock for each product
        await prisma.productStock.upsert({
            where: {
                productId_warehouseId: {
                    productId: product.id,
                    warehouseId: warehouse.id,
                },
            },
            update: {},
            create: {
                productId: product.id,
                warehouseId: warehouse.id,
                quantity: Math.floor(Math.random() * 80) + 20, // 20-100
                avgCost: p.cost,
                lastCost: p.cost,
            },
        });
    }
    console.log('✅ สร้าง 15 สินค้าพร้อม Stock');

    // ═══════════════════════════════════════
    // 6. Customers
    // ═══════════════════════════════════════
    const customers = [
        { name: 'นายสมชาย ปลูกผัก', phone: '081-111-1111', group: retailGroup.id, address: '123 หมู่ 5 ต.ท่าม่วง' },
        { name: 'นางสาวมาลี ทำนา', phone: '082-222-2222', group: retailGroup.id, address: '456 หมู่ 3 ต.หนองสองห้อง' },
        { name: 'นายประเสริฐ สวนยาง', phone: '083-333-3333', group: retailGroup.id, address: '789 หมู่ 8 ต.คลองท่อม' },
        { name: 'ร้านเกษตรพัฒนา', phone: '084-444-4444', group: wholesaleGroup.id, address: '99 ถ.เพชรเกษม ต.เมือง', taxId: '1234567890123' },
        { name: 'สหกรณ์การเกษตรศรีราชา', phone: '085-555-5555', group: wholesaleGroup.id, address: '55 หมู่ 1 ต.ศรีราชา', taxId: '9876543210987' },
        { name: 'นายวิชัย ไร่อ้อย', phone: '086-666-6666', group: retailGroup.id, address: '321 หมู่ 2 ต.โนนสูง' },
    ];

    for (const c of customers) {
        await prisma.customer.create({
            data: {
                name: c.name,
                phone: c.phone,
                customerGroupId: c.group,
                address: c.address,
                taxId: c.taxId,
            },
        });
    }
    console.log('✅ สร้าง 6 ลูกค้าสาธิต');

    // ═══════════════════════════════════════
    // 7. Vendors
    // ═══════════════════════════════════════
    const vendors = [
        { name: 'บ.ไทยเซ็นทรัลเคมี จำกัด', phone: '02-123-4567', address: '100 ถ.พระราม 3 แขวงบางโพงพาง กรุงเทพฯ' },
        { name: 'บ.แกรนด์ออร์แกนิค จำกัด', phone: '02-987-6543', address: '88 ถ.เพชรบุรี แขวงทุ่งพญาไท กรุงเทพฯ' },
        { name: 'ร้านเจริญเกษตรภัณฑ์', phone: '044-555-666', address: '22 ถ.มิตรภาพ ต.ในเมือง อ.เมือง' },
    ];

    for (const v of vendors) {
        await prisma.vendor.create({
            data: { name: v.name, phone: v.phone, address: v.address },
        });
    }
    console.log('✅ สร้าง 3 ผู้ส่งสินค้า');

    // ═══════════════════════════════════════
    // 8. Shop Info
    // ═══════════════════════════════════════
    await prisma.shopInfo.upsert({
        where: { id: 'shop-info' },
        update: {},
        create: {
            id: 'shop-info',
            name: 'ร้านปุ๋ยสาธิต Demo',
            taxId: '1234567890001',
            address: '99/9 ถ.เกษตรนเรศวร ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000',
            notes: 'ระบบสาธิต — ข้อมูลทั้งหมดเป็นข้อมูลจำลอง',
        },
    });
    console.log('✅ สร้างข้อมูลร้าน');

    // ═══════════════════════════════════════
    // 9. Bank Account
    // ═══════════════════════════════════════
    await prisma.bankAccount.create({
        data: {
            accountName: 'ร้านปุ๋ยสาธิต Demo',
            accountNumber: '123-456-7890',
            bankName: 'ธนาคารกสิกรไทย',
            isDefault: true,
        },
    });
    console.log('✅ สร้างบัญชีธนาคาร');

    // ═══════════════════════════════════════
    // 10. Receipt Template
    // ═══════════════════════════════════════
    await prisma.receiptTemplate.create({
        data: {
            warehouseId: warehouse.id,
            name: 'แบบมาตรฐาน',
            isDefault: true,
            headerText: 'ร้านปุ๋ยสาธิต Demo',
            footerText: 'ขอบคุณที่ใช้บริการ',
            paperSize: '80mm',
            showBillNo: true,
            showStaff: true,
            showCustomer: true,
        },
    });
    console.log('✅ สร้างเทมเพลตใบเสร็จ');

    console.log('');
    console.log('══════════════════════════════════════');
    console.log('🎉 Demo Seed เสร็จสมบูรณ์!');
    console.log('══════════════════════════════════════');
    console.log('');
    console.log('📧 Login:');
    console.log('   Admin: admin / admin123');
    console.log('   Staff: demo / demo123');
    console.log('');
    console.log('📦 ข้อมูลที่สร้าง:');
    console.log('   - 2 Users (Admin + Staff)');
    console.log('   - 1 Warehouse');
    console.log('   - 2 Customer Groups');
    console.log('   - 5 Product Groups');
    console.log('   - 15 Products with Stock');
    console.log('   - 6 Customers');
    console.log('   - 3 Vendors');
    console.log('   - 1 Shop Info');
    console.log('   - 1 Bank Account');
    console.log('   - 1 Receipt Template');
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Demo seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
