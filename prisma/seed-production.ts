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
    console.log('🏭 Production Seed — เริ่มต้นข้อมูลสำหรับ site ใหม่...');
    console.log('');

    // 1. Create admin user
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
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

    // 2. Create default warehouse
    await prisma.warehouse.upsert({
        where: { id: 'wh-main' },
        update: {},
        create: {
            id: 'wh-main',
            name: 'คลังหลัก',
            location: '',
            isActive: true,
        },
    });
    console.log('✅ สร้างคลังหลัก');

    // 3. Create default customer groups
    await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าปลีก' },
        update: {},
        create: { name: 'ลูกค้าปลีก' },
    });
    await prisma.customerGroup.upsert({
        where: { name: 'ลูกค้าส่ง' },
        update: {},
        create: { name: 'ลูกค้าส่ง' },
    });
    console.log('✅ สร้างกลุ่มลูกค้า (ปลีก/ส่ง)');

    console.log('');
    console.log('🎉 Production seed เสร็จสมบูรณ์!');
    console.log('');
    console.log('📧 Login:');
    console.log(`   Username: admin`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  กรุณาเปลี่ยนรหัสผ่านหลังเข้าระบบครั้งแรก!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
